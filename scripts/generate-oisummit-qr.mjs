#!/usr/bin/env node
/**
 * Generate OISUMMIT QR codes (SVG) with UTM-encoded production URLs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'qr');
const BASE = 'https://readiness.coaretail.com';

const DESTINATIONS = [
  { id: 'oisummit-general', path: '/oisummit/', content: 'general' },
  { id: 'oisummit-enterprise', path: '/oisummit/enterprise/', content: 'enterprise' },
  { id: 'oisummit-public', path: '/oisummit/public/', content: 'public' },
  { id: 'oisummit-tech', path: '/oisummit/tech/', content: 'tech' },
];

function buildUrl(entry) {
  const params = new URLSearchParams({
    utm_source: 'oisummit',
    utm_medium: 'qr',
    utm_campaign: 'oisummit2026',
    utm_content: entry.content,
  });
  return `${BASE}${entry.path}?${params.toString()}`;
}

async function fetchQrSvg(url) {
  const endpoint = `https://api.qrserver.com/v1/create-qr-code/?format=svg&size=512x512&data=${encodeURIComponent(url)}`;
  const res = await fetch(endpoint, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`qr_fetch_${res.status}`);
  return res.text();
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = [];

  for (const entry of DESTINATIONS) {
    const url = buildUrl(entry);
    let svg;
    try {
      svg = await fetchQrSvg(url);
    } catch (error) {
      console.warn(`QR fetch failed for ${entry.id}:`, error.message);
      svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><desc>${url.replace(/&/g, '&amp;')}</desc></svg>`;
    }
    const svgPath = path.join(OUT_DIR, `${entry.id}.svg`);
    fs.writeFileSync(svgPath, svg, 'utf8');
    manifest.push({ id: entry.id, url, svg: path.relative(ROOT, svgPath) });
  }

  fs.writeFileSync(path.join(OUT_DIR, 'oisummit-qr-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('Generated', manifest.length, 'OISUMMIT QR files → public/qr/');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
