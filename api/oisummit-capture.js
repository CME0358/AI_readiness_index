import { timingSafeEqual } from 'node:crypto';
import {
  buildCaptureFields,
  cleanCaptureValue,
  validateCaptureFields,
  writeCaptureToAirtable,
} from '../scripts/lib/oisummit/capture-core.mjs';

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

function authMatches(req) {
  const expected = process.env.OISUMMIT_CAPTURE_ACCESS_TOKEN || '';
  const presented = req.headers?.authorization || '';
  if (!expected || !presented) return false;
  const expectedBytes = Buffer.from(`Bearer ${expected}`, 'utf8');
  const presentedBytes = Buffer.from(presented, 'utf8');
  return expectedBytes.length === presentedBytes.length && timingSafeEqual(expectedBytes, presentedBytes);
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    json(res, 405, { error: 'method_not_allowed' });
    return;
  }
  if (!authMatches(req)) {
    json(res, 401, { error: 'unauthorized' });
    return;
  }

  if (req.headers?.['x-oisummit-auth-check'] === '1') {
    json(res, 200, { authenticated: true });
    return;
  }

  const input = await readBody(req);
  if (!input) {
    json(res, 400, { error: 'invalid_json' });
    return;
  }

  const captureId = cleanCaptureValue(input.capture_id, 100);
  const targetId = cleanCaptureValue(input.target_id, 100);
  const targetName = cleanCaptureValue(input.target_name, 160);
  const result = cleanCaptureValue(input.result, 20);
  if (!captureId || !targetId || !targetName || !result) {
    json(res, 400, { error: 'target_id_target_name_and_result_required' });
    return;
  }

  const fields = buildCaptureFields(input);
  const errors = validateCaptureFields(fields);
  if (errors.length) {
    json(res, 400, { error: errors[0] });
    return;
  }

  const write = await writeCaptureToAirtable(fields);
  json(res, write.status, write.body);
}
