import fs from 'node:fs';
import path from 'node:path';

const REDIRECTS = path.join(process.cwd(), 'insights/_social/x-sidecar/redirects.json');
const SAFE_DESTINATION = /^https:\/\/readiness\.coaretail\.com\/insights\/[a-z0-9-]+\/\?utm_source=x&utm_medium=organic&utm_campaign=ari_x_traffic&utm_content=[0-9]{6}_[0-9]{4}$/;

export default function handler(req, res) {
  const id = String(req.query?.short_id || '').toLowerCase();
  if (!/^[a-z0-9-]{4,64}$/.test(id) || !fs.existsSync(REDIRECTS)) {
    res.status(404).end('Not Found');
    return;
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(REDIRECTS, 'utf8'));
  } catch {
    res.status(503).end('Redirect authority unavailable');
    return;
  }
  const entry = (manifest.redirects || []).find((item) => item.short_id === id);
  if (!entry || !SAFE_DESTINATION.test(entry.destination)) {
    res.status(404).end('Not Found');
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(302, entry.destination);
}
