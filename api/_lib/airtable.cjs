function airtableConfig() {
  return {
    apiKey: process.env.AIRTABLE_API_KEY || '',
    baseId: process.env.AIRTABLE_BASE_ID || '',
    leadsTable: process.env.AIRTABLE_TABLE_NAME || 'Leads',
    conversionsTable: process.env.AIRTABLE_CONVERSIONS_TABLE_NAME || '',
  };
}

function formulaString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function fieldsForLead(lead) {
  return {
    lead_id: lead.leadId,
    '会社名': lead.company, 'URL': lead.domain, 'メールアドレス': lead.email, '業種': lead.industry, '役割': lead.role,
    'セグメント': lead.segment, 'Partner Type': lead.partnerType, 'Direct Buyer Type': lead.directBuyerType,
    source: lead.source, medium: lead.medium, campaign: lead.campaign, landing_page: lead.landingPage, referrer: lead.referrer,
    cta_id: lead.ctaId, cta_type: lead.ctaType,
    first_touch: JSON.stringify(lead.firstTouch || {}), last_touch: JSON.stringify(lead.lastTouch || {}),
    route_action: lead.routeAction || '', route_destination: lead.routeDestination || '', route_version: lead.routeVersion || '',
    route_confidence: lead.routeConfidence ?? null, route_confidence_band: lead.routeConfidenceBand || '',
    consent_type: lead.consentType || 'SERVICE_ONLY', consent_version: lead.consentVersion || '1',
    consented_at: lead.consentedAt || '', consent_source: lead.consentSource || 'WHITEPAPER',
    created_at: lead.createdAt, updated_at: lead.updatedAt, schema_version: lead.schemaVersion,
  };
}

async function airtableRequest(path, options = {}) {
  const config = airtableConfig();
  if (!config.apiKey || !config.baseId) return { ok: false, reason: 'not_configured' };
  const signal = AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined;
  try {
    const response = await fetch(`https://api.airtable.com/v0/${config.baseId}/${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}`, ...(options.headers || {}) },
      ...(signal ? { signal } : {}),
    });
    const body = await response.json().catch(() => ({}));
    return response.ok ? { ok: true, body } : { ok: false, reason: `airtable_${response.status}`, body };
  } catch (error) {
    return { ok: false, reason: error?.name === 'TimeoutError' ? 'timeout' : 'airtable_error' };
  }
}

async function findLeadByIdentity(lead) {
  const config = airtableConfig();
  const formula = `AND({メールアドレス}='${formulaString(lead.email)}',{URL}='${formulaString(lead.domain)}')`;
  const path = `${encodeURIComponent(config.leadsTable)}?maxRecords=1&filterByFormula=${encodeURIComponent(formula)}`;
  const result = await airtableRequest(path, { method: 'GET' });
  return result.ok ? { record: result.body.records?.[0] || null, error: null } : { record: null, error: result.reason };
}

async function upsertLeadToAirtable(lead) {
  const config = airtableConfig();
  if (!config.apiKey || !config.baseId) return { saved: false, reason: 'not_configured' };
  const lookup = await findLeadByIdentity(lead);
  if (lookup.error) return { saved: false, reason: lookup.error };
  const existing = lookup.record;
  const fields = fieldsForLead(lead);
  if (existing) {
    const existingLeadId = existing.fields?.lead_id || lead.leadId;
    if (existing.fields?.lead_id) delete fields.lead_id;
    delete fields.first_touch;
    delete fields.created_at;
    fields.updated_at = lead.updatedAt;
    const result = await airtableRequest(`${encodeURIComponent(config.leadsTable)}/${encodeURIComponent(existing.id)}`, { method: 'PATCH', body: JSON.stringify({ fields, typecast: true }) });
    return result.ok ? { saved: true, recordId: existingLeadId, storageRecordId: existing.id, updated: true } : { saved: false, reason: result.reason };
  }
  const result = await airtableRequest(encodeURIComponent(config.leadsTable), { method: 'POST', body: JSON.stringify({ fields, typecast: true }) });
  return result.ok ? { saved: true, recordId: lead.leadId, storageRecordId: result.body.id || null, updated: false } : { saved: false, reason: result.reason };
}

function conversionFields(record, dedupeKey) {
  return {
    conversion_id: record.conversionId || '', lead_id: record.leadId || '', conversion_type: record.conversionType,
    segment: record.segment || '', partner_type: record.partnerType || '', qualification_band: record.qualificationBand || '',
    source_page: record.sourcePage || '', insight_slug: record.insightSlug || '', cta_id: record.ctaId || '', cta_type: record.ctaType || '',
    first_touch: JSON.stringify(record.firstTouch || {}), last_touch: JSON.stringify(record.lastTouch || {}), value: record.value ?? null,
    currency: record.currency || 'JPY', external_reference: record.externalReference || '', dedupe_key: dedupeKey,
    occurred_at: record.occurredAt, schema_version: record.schemaVersion || '1',
  };
}

async function findConversionByDedupeKey(dedupeKey) {
  const config = airtableConfig();
  if (!config.conversionsTable) return null;
  const formula = `{dedupe_key}='${formulaString(dedupeKey)}'`;
  const result = await airtableRequest(`${encodeURIComponent(config.conversionsTable)}?maxRecords=1&filterByFormula=${encodeURIComponent(formula)}`, { method: 'GET' });
  return result.ok ? (result.body.records?.[0] || null) : null;
}

async function saveConversionToAirtable(record, dedupeKey) {
  const config = airtableConfig();
  if (!config.conversionsTable) return { saved: false, reason: 'conversion_table_not_configured' };
  if (await findConversionByDedupeKey(dedupeKey)) return { saved: false, duplicate: true, key: dedupeKey };
  const result = await airtableRequest(encodeURIComponent(config.conversionsTable), { method: 'POST', body: JSON.stringify({ fields: conversionFields(record, dedupeKey), typecast: true }) });
  return result.ok ? { saved: true, storageRecordId: result.body.id || null, key: dedupeKey } : { saved: false, reason: result.reason };
}

module.exports = { airtableConfig, fieldsForLead, findLeadByIdentity, upsertLeadToAirtable, findConversionByDedupeKey, saveConversionToAirtable };
