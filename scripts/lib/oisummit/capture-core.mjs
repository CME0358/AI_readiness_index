import { randomUUID } from 'node:crypto';
import { makeAdhocTargetId } from './target-registry.mjs';

export const CAPTURE_ALLOWED = Object.freeze({
  result: new Set(['HOT', 'WARM', 'CONTACT', 'MISS']),
  next_action: new Set(['MEETING', 'INTRO', 'MATERIAL', 'FOLLOW', 'NONE']),
  due: new Set(['9/14', '9/15', '9/16', 'CUSTOM', 'NONE']),
  contact_method: new Set(['BUSINESS_CARD', 'EMAIL', 'LINKEDIN', 'QR', 'OTHER', 'NONE']),
  route: new Set(['AGENT_EXECUTION', 'AGENT_READINESS', 'MAR', 'PARTNERSHIP']),
  priority: new Set(['MUST', 'CORE', 'BACKUP']),
  target_type: new Set(['company', 'government', 'partner', 'other']),
});

export function cleanCaptureValue(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function buildCaptureFields(input, now = new Date()) {
  const captureId = cleanCaptureValue(input.capture_id, 100) || randomUUID();
  const targetId = cleanCaptureValue(input.target_id, 100);
  const targetName = cleanCaptureValue(input.target_name, 160);
  const result = cleanCaptureValue(input.result, 20);
  const route = cleanCaptureValue(input.route, 40);
  const priority = cleanCaptureValue(input.priority, 20);
  const targetType = cleanCaptureValue(input.target_type, 20);
  const nextRaw = cleanCaptureValue(input.next_action, 20);
  const dueRaw = cleanCaptureValue(input.due, 20);
  const methodRaw = cleanCaptureValue(input.contact_method, 30);

  const fields = {
    capture_id: captureId,
    event: 'OISUMMIT_2026',
    captured_at: cleanCaptureValue(input.captured_at, 80) || now.toISOString(),
    target_id: targetId,
    target_name: targetName,
    target_type: targetType,
    priority,
    route,
    person: cleanCaptureValue(input.person, 160),
    department_title: cleanCaptureValue(input.department_title, 200),
    result,
    memo: cleanCaptureValue(input.memo, 300),
    next_action: CAPTURE_ALLOWED.next_action.has(nextRaw) ? nextRaw : 'NONE',
    due: CAPTURE_ALLOWED.due.has(dueRaw) ? dueRaw : 'NONE',
    contact_method: CAPTURE_ALLOWED.contact_method.has(methodRaw) ? methodRaw : 'NONE',
    source: cleanCaptureValue(input.source, 40) || 'oisummit_capture',
    created_at: now.toISOString(),
  };

  return fields;
}

export function validateCaptureFields(fields) {
  const errors = [];
  if (!fields.capture_id || !fields.target_id || !fields.target_name || !CAPTURE_ALLOWED.result.has(fields.result)) {
    errors.push('target_id_target_name_and_result_required');
  }
  if (!CAPTURE_ALLOWED.route.has(fields.route) ||
      !CAPTURE_ALLOWED.priority.has(fields.priority) ||
      !CAPTURE_ALLOWED.target_type.has(fields.target_type)) {
    errors.push('invalid_target_metadata');
  }
  return errors;
}

export function normalizeRegisteredTarget(target) {
  return {
    target_id: target.id,
    target_name: target.name,
    target_type: target.type,
    priority: target.priority,
    route: target.route,
  };
}

export function normalizeAdhocTarget({ name, type, route }, id = makeAdhocTargetId()) {
  return {
    target_id: id,
    target_name: name,
    target_type: type,
    priority: 'BACKUP',
    route,
  };
}

async function airtableRequest(baseId, table, apiKey, path = '', init = {}) {
  const endpoint = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}${path}`;
  const response = await fetch(endpoint, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
  });
  return response;
}

export async function writeCaptureToAirtable(fields, env = process.env) {
  const enabled = env.OISUMMIT_CAPTURE_WRITE_ENABLED === 'true';
  const apiKey = env.AIRTABLE_API_KEY;
  const baseId = env.AIRTABLE_BASE_ID;
  const table = env.OISUMMIT_CAPTURES_TABLE_NAME;
  if (!enabled || !apiKey || !baseId || !table) {
    return { ok: false, status: 503, body: { error: 'CONFIG_REQUIRED' } };
  }

  const errors = validateCaptureFields(fields);
  if (errors.length) {
    return { ok: false, status: 400, body: { error: errors[0] } };
  }

  try {
    const formula = encodeURIComponent(`{capture_id}='${fields.capture_id.replace(/'/g, "\\'")}'`);
    const existing = await airtableRequest(baseId, table, apiKey, `?maxRecords=1&filterByFormula=${formula}`);
    if (!existing.ok) {
      return { ok: false, status: 502, body: { error: 'airtable_lookup_failed' } };
    }
    const existingBody = await existing.json();
    if (existingBody.records?.length) {
      return { ok: true, status: 200, body: { saved: true, duplicate: true, capture_id: fields.capture_id } };
    }

    const created = await airtableRequest(baseId, table, apiKey, '', {
      method: 'POST',
      body: JSON.stringify({ fields, typecast: true }),
    });
    if (!created.ok) {
      return { ok: false, status: 502, body: { error: 'airtable_write_failed' } };
    }
    return { ok: true, status: 201, body: { saved: true, duplicate: false, capture_id: fields.capture_id } };
  } catch (error) {
    console.error('[oisummit-capture]', error?.message || error);
    return { ok: false, status: 502, body: { error: 'storage_unavailable' } };
  }
}
