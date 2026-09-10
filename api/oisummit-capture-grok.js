import { timingSafeEqual } from 'node:crypto';
import { parseCaptureMessage, formatPreview } from '../scripts/lib/oisummit/grok-parser.mjs';
import { writeCaptureToAirtable, buildCaptureFields, validateCaptureFields } from '../scripts/lib/oisummit/capture-core.mjs';

const MAX_BODY_BYTES = 16 * 1024;
const FALLBACK_URL = 'https://readiness.coaretail.com/oisummit/capture';

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

function authMatches(req) {
  const expected = process.env.OISUMMIT_GROK_CAPTURE_BOT_TOKEN
    || process.env.OISUMMIT_CAPTURE_ACCESS_TOKEN
    || '';
  const presented = req.headers?.authorization || '';
  if (!expected || !presented) return false;
  const expectedBytes = Buffer.from(`Bearer ${expected}`, 'utf8');
  const presentedBytes = Buffer.from(presented, 'utf8');
  return expectedBytes.length === presentedBytes.length && timingSafeEqual(expectedBytes, presentedBytes);
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new Error('body_too_large');
  }
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

  const input = await readBody(req);
  if (!input) {
    json(res, 400, { error: 'invalid_json' });
    return;
  }

  const confirm = input.confirm === true;
  let parsed;

  if (input.capture && typeof input.capture === 'object') {
    const fields = buildCaptureFields(input.capture);
    const errors = validateCaptureFields(fields);
    parsed = errors.length
      ? { status: 'needs_confirmation', missing: errors, questions: ['入力内容を確認してください。'], draft: input.capture }
      : { status: 'ready', draft: input.capture, fields, preview: formatPreview(fields) };
  } else if (input.message) {
    parsed = parseCaptureMessage(input.message, { now: input.now });
  } else {
    json(res, 400, { error: 'message_or_capture_required' });
    return;
  }

  if (parsed.status === 'ignored') {
    json(res, 200, { status: 'ignored', reason: parsed.reason });
    return;
  }

  if (parsed.status === 'needs_confirmation') {
    json(res, 200, {
      status: 'needs_confirmation',
      missing: parsed.missing,
      questions: parsed.questions,
      preview: parsed.preview || null,
      draft: parsed.draft || null,
      fallback_url: FALLBACK_URL,
    });
    return;
  }

  if (!confirm) {
    json(res, 200, {
      status: 'preview',
      preview: parsed.preview,
      draft: parsed.draft,
      message: '保存する場合は confirm=true を付けて再送してください。',
      fallback_url: FALLBACK_URL,
    });
    return;
  }

  const write = await writeCaptureToAirtable(parsed.fields);
  if (!write.ok) {
    json(res, write.status, {
      status: 'failed',
      error: write.body.error,
      fallback_url: FALLBACK_URL,
      message: 'OISUMMIT Captureへの保存に失敗しました。既存Captureから入力してください。',
    });
    return;
  }

  json(res, write.status, {
    status: 'saved',
    saved: write.body.saved,
    duplicate: write.body.duplicate,
    capture_id: write.body.capture_id,
    preview: parsed.preview,
    message: formatSuccessMessage(parsed.draft),
  });
}

function formatSuccessMessage(draft) {
  const lines = [
    '保存しました。',
    '',
    draft.target_name,
    `${draft.result} / ${draft.route}`,
  ];
  if (draft.memo) lines.push(`Memo: ${draft.memo}`);
  if (draft.next_action && draft.next_action !== 'NONE') lines.push(`Next: ${draft.next_action}`);
  if (draft.due && draft.due !== 'NONE') lines.push(`Due: ${draft.due}`);
  return lines.join('\n');
}
