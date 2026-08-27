const MAX_BODY_BYTES = 20 * 1024;

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) reject(new Error('body_too_large'));
    });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('invalid_json')); } });
    req.on('error', reject);
  });
}

function response(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

const { upsertLeadToAirtable } = require('./_lib/airtable.cjs');

async function saveLeadToAirtable(lead) { return upsertLeadToAirtable(lead); }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return response(res, 405, { error: 'method_not_allowed' });
  try {
    const input = await readBody(req);
    const { buildWhitepaperLead } = await import('../scripts/lib/funnel/lead-capture.mjs');
    const { createLeadRepository } = await import('../scripts/lib/funnel/lead-repository.mjs');
    const { resolveLeadRoute } = await import('../scripts/lib/funnel/routing.mjs');
    const built = buildWhitepaperLead(input, { now: new Date().toISOString() });
    if (!built.valid) return response(res, 400, { error: 'invalid_form', fields: built.errors });
    const route = resolveLeadRoute(built.classification);
    const repository = createLeadRepository({
      saveLead: saveLeadToAirtable,
      updateLead: async () => ({ updated: false, reason: 'not_implemented' }),
    });
    const result = await repository.saveLead({ ...built.lead,
      routeAction: route.action,
      routeDestination: route.destination,
      routeVersion: route.version,
      routeConfidence: route.confidence,
      routeConfidenceBand: route.confidenceBand,
    });
    if (!result.saved) return response(res, 503, { error: 'lead_persistence_unavailable', reason: result.reason });
    return response(res, 201, { ok: true, leadId: result.recordId || built.lead.leadId, storageRecordId: result.storageRecordId || null, segment: built.lead.segment, partnerType: built.lead.partnerType, directBuyerType: built.lead.directBuyerType, confidence: built.classification.confidence, route });
  } catch (error) {
    return response(res, 400, { error: error?.message === 'body_too_large' ? 'body_too_large' : 'invalid_request' });
  }
};
