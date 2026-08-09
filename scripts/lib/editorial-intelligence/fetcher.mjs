import fs from 'node:fs';

/** Simple RSS/Atom item extraction — metadata only, no full body storage. */

const ITEM_RE = /<item[\s\S]*?<\/item>/gi;
const ENTRY_RE = /<entry[\s\S]*?<\/entry>/gi;

function pickTag(block, names) {
  for (const name of names) {
    const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i');
    const m = block.match(re);
    if (m) return stripCdata(m[1]).trim();
  }
  return '';
}

function pickLink(block) {
  const alt = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  if (alt) return alt[1].trim();
  const plain = pickTag(block, ['link']);
  return plain;
}

function stripCdata(s) {
  return s.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').replace(/<[^>]+>/g, ' ').trim();
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return (url || '').trim();
  }
}

function excerpt(text, max = 280) {
  const clean = stripCdata(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export function parseFeedItems(xml, { company, sourceId, sourceType, sourceLevel = 'A' }) {
  if (!xml || typeof xml !== 'string') return [];
  const blocks = [...xml.matchAll(ITEM_RE)].map((m) => m[0]);
  const entries = blocks.length ? blocks : [...xml.matchAll(ENTRY_RE)].map((m) => m[0]);
  const fetchedAt = new Date().toISOString();
  return entries.slice(0, 20).map((block, idx) => {
    const title = pickTag(block, ['title']) || 'Untitled';
    const url = normalizeUrl(pickLink(block) || pickTag(block, ['guid', 'id']));
    const pubRaw = pickTag(block, ['pubDate', 'published', 'updated', 'dc:date']);
    const publishedDate = pubRaw ? new Date(pubRaw).toISOString() : null;
    const description = pickTag(block, ['description', 'summary', 'content']);
    const itemId = url || `${sourceId}-${title.slice(0, 40)}-${idx}`;
    return {
      item_id: itemId,
      company,
      source_id: sourceId,
      source_type: sourceType,
      source_level: sourceLevel,
      title,
      url,
      published_date: publishedDate,
      excerpt: excerpt(description),
      fetched_at: fetchedAt,
    };
  }).filter((i) => i.title && i.url);
}

export async function fetchFeed(url, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AgentReadiness-EditorialIntelligence/1.0 (+https://readiness.coaretail.com)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > 500_000) throw new Error('FEED_TOO_LARGE');
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export function loadBackfillFixtures(fixturesPath) {
  if (!fs.existsSync(fixturesPath)) return [];
  return JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
}
