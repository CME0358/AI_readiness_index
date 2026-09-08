import fs from 'node:fs';
import path from 'node:path';
import { validateReferralDestination } from '../../scripts/lib/referral/redirect-validator.mjs';

const SIDECAR_REDIRECTS = path.join(process.cwd(), 'insights/_social/x-sidecar/redirects.json');
const REFERRAL_REDIRECTS = path.join(process.cwd(), 'insights/_social/referral/redirects.json');

const SAFE_SIDECAR_DESTINATION = /^https:\/\/readiness\.coaretail\.com\/insights\/[a-z0-9-]+\/\?utm_source=x&utm_medium=organic&utm_campaign=ari_x_traffic&utm_content=[0-9]{6}_[0-9]{4}$/;

function loadManifest(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function findRedirect(id) {
  const sidecar = loadManifest(SIDECAR_REDIRECTS);
  if (sidecar) {
    const entry = (sidecar.redirects || []).find((item) => item.short_id === id);
    if (entry && SAFE_SIDECAR_DESTINATION.test(entry.destination)) {
      return { entry, kind: 'sidecar' };
    }
  }

  const referral = loadManifest(REFERRAL_REDIRECTS);
  if (referral) {
    const entry = (referral.redirects || []).find((item) => item.short_id === id);
    if (entry && validateReferralDestination(entry.destination)) {
      return { entry, kind: 'referral' };
    }
  }

  return null;
}

export default function handler(req, res) {
  const id = String(req.query?.short_id || '').toLowerCase();
  if (!/^[a-z0-9-]{4,64}$/.test(id)) {
    res.status(404).end('Not Found');
    return;
  }

  const match = findRedirect(id);
  if (!match) {
    res.status(404).end('Not Found');
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Redirect-Kind', match.kind);
  res.redirect(302, match.entry.destination);
}
