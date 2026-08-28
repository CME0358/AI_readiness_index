import { createQualification, validateQualification } from '../scripts/lib/funnel/qualification.mjs';
import { resolveCompanyReportProductFromStripeSession } from './verify-purchase.js';

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  return new Promise((resolve) => { let raw = ''; req.on('data', (chunk) => { raw += chunk; }); req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } }); req.on('error', () => resolve({})); });
}

function send(res, status, body) { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); }

async function saveQualificationToAirtable(qualification, input) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const recordId = String(input.leadRecordId || '').trim();
  if (!apiKey || !baseId || !recordId) return { saved: false, reason: 'manual_action_required' };
  const { resolveInboundAirtableTables, serializeInboundQualification } = await import('./_lib/airtable.cjs');
  const tables = resolveInboundAirtableTables();
  if (!tables.writeEnabled || !tables.leadsTable) return { saved: false, reason: tables.environment === 'unknown' ? 'unknown_environment' : 'inbound_airtable_not_configured' };
  const fields = serializeInboundQualification(qualification, tables.leadsTable);
  if (!fields) return { saved: false, reason: 'unsupported_inbound_table' };
  // Canonical storage keeps lead_id: qualification.leadId through the serializer.
  const endpoint = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tables.leadsTable)}/${encodeURIComponent(recordId)}`;
  const result = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ fields, typecast: true }) });
  return result.ok ? { saved: true } : { saved: false, reason: `airtable_${result.status}` };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  if (!process.env.STRIPE_SECRET_KEY) return send(res, 503, { error: 'verification_unconfigured' });
  try {
    const input = await readBody(req);
    const sessionId = String(input.sessionId || '').trim();
    if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return send(res, 400, { error: 'invalid_session_id' });
    const { retrieveCheckoutSession } = await import('./verify-purchase.js');
    const session = await retrieveCheckoutSession(sessionId, process.env.STRIPE_SECRET_KEY);
    const product = resolveCompanyReportProductFromStripeSession(session, { expectedPaymentLinkId: process.env.COMPANY_REPORT_STRIPE_PAYMENT_LINK_ID });
    if (!product) return send(res, 403, { error: 'company_report_verification_required' });
    const validation = validateQualification(input);
    if (!validation.valid) return send(res, 400, { error: 'invalid_qualification', fields: validation.errors });
    const qualification = createQualification(input);
    const saved = await saveQualificationToAirtable(qualification, input);
    if (!saved.saved) return send(res, 503, { error: 'qualification_persistence_unavailable', reason: saved.reason });
    return send(res, 201, { ok: true, qualification: { ...qualification, note: undefined } });
  } catch (error) {
    return send(res, 400, { error: error?.message || 'invalid_request' });
  }
}

export { saveQualificationToAirtable };
