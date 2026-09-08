/** Homepage lightweight HTML observation endpoint. */
import {
  publicView,
  runPublicCheck,
} from '../scripts/lib/funnel/public-check.mjs';

export const config = {
  // Outbound fetch for JP Cloudflare zones is more reliable from Tokyo than US regions.
  regions: ['hnd1'],
};

const MAX_BODY_BYTES = 8 * 1024;

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body || '{}'); } catch { return {}; }
    }
    return req.body;
  }
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) reject(new Error('body_too_large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const input = await readBody(req);
    const result = await runPublicCheck(
      { url: input.url || input.domain },
      { region: process.env.VERCEL_REGION || 'unknown' },
    );
    return send(res, result.status || (result.ok ? 200 : 400), publicView(result));
  } catch {
    return send(res, 400, { ok: false, error: 'invalid_request', findings: [] });
  }
}
