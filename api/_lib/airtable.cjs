function airtableConfig() {
  const tables = resolveInboundAirtableTables();
  return {
    apiKey: process.env.AIRTABLE_API_KEY || '',
    baseId: process.env.AIRTABLE_BASE_ID || '',
    leadsTable: tables.leadsTable,
    conversionsTable: tables.conversionsTable,
    environment: tables.environment,
    writeEnabled: tables.writeEnabled,
  };
}

function resolveInboundAirtableTables(env = process.env) {
  const requested = String(env?.VERCEL_ENV || env?.VERCEL_TARGET_ENV || '').trim().toLowerCase();
  const environment = ['production', 'preview', 'development'].includes(requested) ? requested : 'unknown';
  const leadsTable = environment === 'production'
    ? String(env?.INBOUND_LEADS_TABLE_NAME || '').trim()
    : environment === 'preview' || environment === 'development'
      ? String(env?.INBOUND_LEADS_STAGING_TABLE_NAME || '').trim()
      : '';
  const conversionsTable = environment === 'production'
    ? String(env?.INBOUND_CONVERSIONS_TABLE_NAME || '').trim()
    : environment === 'preview' || environment === 'development'
      ? String(env?.INBOUND_CONVERSIONS_STAGING_TABLE_NAME || '').trim()
      : '';
  return Object.freeze({ environment, leadsTable: leadsTable || null, conversionsTable: conversionsTable || null, writeEnabled: Boolean(leadsTable && conversionsTable) });
}

function formulaString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function tableFamily(tableName) {
  const table = String(tableName || '').trim();
  if (table === 'Leads') return 'legacy_leads';
  if (table === 'Inbound_Leads' || table === 'Inbound_Leads_Staging') return 'inbound_leads';
  if (table === 'Inbound_Conversions' || table === 'Inbound_Conversions_Staging') return 'inbound_conversions';
  return null;
}

function serializeLegacyLead(lead) {
  // Legacy Leads identity contract remains: メールアドレス + URL.
  return {
    '会社名': lead.company, 'URL': lead.domain, 'メールアドレス': lead.email, '業種': lead.industry,
  };
}

function serializeInboundLead(lead, tableName) {
  if (tableFamily(tableName) !== 'inbound_leads') return null;
  return {
    lead_id: lead.leadId, company: lead.company, domain: lead.domain, email: lead.email, industry: lead.industry, role: lead.role,
    segment: lead.segment, partner_type: lead.partnerType, direct_buyer_type: lead.directBuyerType,
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

function fieldsForLead(lead, tableName) {
  return serializeInboundLead(lead, tableName);
}

function serializeInboundQualification(qualification, tableName) {
  if (tableFamily(tableName) !== 'inbound_leads') return null;
  return {
    lead_id: qualification.leadId || '',
    qualification_purpose: qualification.purpose,
    qualification_scope: qualification.scope,
    qualification_timeline: qualification.timeline,
    qualification_note: qualification.note || '',
    qualification_band: qualification.qualificationBand,
    qualification_score: qualification.qualificationScore,
    recommended_action: qualification.recommendedAction,
  };
}

async function airtableRequest(path, options = {}) {
  const config = airtableConfig();
  if (!config.apiKey || !config.baseId || !config.writeEnabled) return { ok: false, reason: config.environment === 'unknown' ? 'unknown_environment' : 'inbound_airtable_not_configured' };
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
  const formula = `AND({email}='${formulaString(lead.email)}',{domain}='${formulaString(lead.domain)}')`;
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
  const fields = serializeInboundLead(lead, config.leadsTable);
  if (!fields) return { saved: false, reason: 'unsupported_inbound_table' };
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

function serializeInboundConversion(record, dedupeKey, tableName) {
  if (tableFamily(tableName) !== 'inbound_conversions') return null;
  return {
    conversion_id: record.conversionId || '', lead_id: record.leadId || '', conversion_type: record.conversionType,
    segment: record.segment || '', partner_type: record.partnerType || '', qualification_band: record.qualificationBand || '',
    source_page: record.sourcePage || '', insight_slug: record.insightSlug || '', cta_id: record.ctaId || '', cta_type: record.ctaType || '',
    first_touch: JSON.stringify(record.firstTouch || {}), last_touch: JSON.stringify(record.lastTouch || {}), value: record.value ?? null,
    currency: record.currency || 'JPY', external_reference: record.externalReference || '', dedupe_key: dedupeKey,
    occurred_at: record.occurredAt, schema_version: record.schemaVersion || '1',
  };
}

function conversionFields(record, dedupeKey, tableName) {
  return serializeInboundConversion(record, dedupeKey, tableName);
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
  const fields = serializeInboundConversion(record, dedupeKey, config.conversionsTable);
  if (!fields) return { saved: false, reason: 'unsupported_inbound_table' };
  const result = await airtableRequest(encodeURIComponent(config.conversionsTable), { method: 'POST', body: JSON.stringify({ fields, typecast: true }) });
  return result.ok ? { saved: true, storageRecordId: result.body.id || null, key: dedupeKey } : { saved: false, reason: result.reason };
}

module.exports = {
  airtableConfig, resolveInboundAirtableTables, tableFamily, serializeLegacyLead, serializeInboundLead,
  serializeInboundQualification, fieldsForLead, findLeadByIdentity, upsertLeadToAirtable,
  serializeInboundConversion, conversionFields, findConversionByDedupeKey, saveConversionToAirtable,
};
