/**
 * /api/preview/[token] — Return public-safe preview snapshot from persistent store.
 */

import {
  PreviewStoreError,
  loadSnapshot,
} from '../../scripts/lib/preview-snapshot-store.mjs';
import { isValidToken, publicSnapshotView } from '../../scripts/lib/preview-snapshot-schema.mjs';

function extractToken(req) {
  const urlPath = (req.url || '').split('?')[0];
  const match = urlPath.match(/\/api\/preview\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'private, max-age=60');

  if (req.method && req.method !== 'GET') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }

  const token = extractToken(req);
  if (!token || !isValidToken(token)) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'preview_not_found' }));
    return;
  }

  let snapshot;
  try {
    snapshot = await loadSnapshot(token);
  } catch (e) {
    const code = e instanceof PreviewStoreError ? e.code : 'PREVIEW_STORE_ERROR';
    res.statusCode = code === 'PREVIEW_STORE_UNCONFIGURED' ? 503 : 503;
    res.end(JSON.stringify({ error: 'preview_store_unavailable' }));
    return;
  }

  if (!snapshot) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'preview_not_found' }));
    return;
  }

  if (snapshot.preview?.blocked) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'preview_not_found' }));
    return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify(publicSnapshotView(snapshot)));
}
