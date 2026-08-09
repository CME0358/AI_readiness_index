import fs from 'node:fs';
import { tagLiveItem, tagFixtureItems } from './item-origin.mjs';

/** Simple RSS/Atom item extraction — metadata only, no full body storage. */

const ITEM_RE = /<item[\s\S]*?<\/item>/gi;
const ENTRY_RE = /<entry[\s\S]*?<\/entry>/gi;

export const DEFAULT_MAX_FEED_BYTES = 500_000;

/** Source-specific safe limits (RMVU-05F). Incremental parse stops early — limit is a safety cap only. */
export const SOURCE_FETCH_PROFILES = {
  'openai-blog': {
    mode: 'rss_incremental',
    maxFeedBytes: 800_000,
    maxItems: 20,
  },
  'anthropic-news': {
    mode: 'html_listing',
    listingUrl: 'https://www.anthropic.com/news',
    maxItems: 20,
  },
};

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

function decodeHtmlEntities(text = '') {
  return text
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
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

function parseDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
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
    return tagLiveItem({
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
    });
  }).filter((i) => i.title && i.url);
}

/**
 * Stream-fetch RSS and extract first N items without loading the full feed body.
 * OpenAI news RSS exceeds 500KB; incremental parse avoids FEED_TOO_LARGE.
 */
export async function fetchFeedIncremental(url, {
  maxItems = 20,
  maxFeedBytes = 800_000,
  timeoutMs = 15000,
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AgentReadiness-EditorialIntelligence/1.0 (+https://readiness.coaretail.com)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body?.getReader?.();
    if (!reader) {
      const text = await res.text();
      if (text.length > maxFeedBytes) throw new Error('FEED_TOO_LARGE');
      return { ok: true, text, truncated: false };
    }

    const decoder = new TextDecoder();
    let buffer = '';
    const itemBlocks = [];
    let totalBytes = 0;

    while (itemBlocks.length < maxItems) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxFeedBytes) break;
      buffer += decoder.decode(value, { stream: true });

      const itemRe = /<item[\s\S]*?<\/item>/gi;
      let m;
      let lastIndex = 0;
      while ((m = itemRe.exec(buffer)) !== null) {
        itemBlocks.push(m[0]);
        lastIndex = m.index + m[0].length;
        if (itemBlocks.length >= maxItems) break;
      }
      if (itemBlocks.length >= maxItems) break;
      if (lastIndex > 0) buffer = buffer.slice(lastIndex);
    }

    try {
      await reader.cancel();
    } catch {
      /* non-fatal */
    }

    if (!itemBlocks.length) {
      return { ok: false, error: 'NO_ITEMS_PARSED' };
    }

    const xml = `<?xml version="1.0"?><rss><channel>${itemBlocks.join('')}</channel></rss>`;
    return { ok: true, text: xml, truncated: true, itemsFound: itemBlocks.length };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFeed(url, { timeoutMs = 15000, maxBytes = DEFAULT_MAX_FEED_BYTES } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AgentReadiness-EditorialIntelligence/1.0 (+https://readiness.coaretail.com)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > maxBytes) throw new Error('FEED_TOO_LARGE');
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/** Parse official Anthropic newsroom HTML listing (no third-party feed). */
export function parseAnthropicNewsListing(html, { company, sourceId, sourceType, sourceLevel = 'A', maxItems = 20 } = {}) {
  if (!html) return [];
  const fetchedAt = new Date().toISOString();
  const byUrl = new Map();

  const featuredRe = /href="(\/news\/[a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = featuredRe.exec(html)) !== null) {
    const url = normalizeUrl(`https://www.anthropic.com${m[1]}`);
    const inner = m[2];
    const titleM = inner.match(/featuredTitle[^>]*>([^<]+)/i) || inner.match(/headline-[^"]*"[^>]*>([^<]+)/i);
    const dateM = inner.match(/>(\w+ \d{1,2}, \d{4})</);
    if (titleM) {
      byUrl.set(url, {
        title: decodeHtmlEntities(titleM[1].trim()),
        published_date: parseDate(dateM?.[1]),
      });
    }
  }

  const listRe = /<a href="(\/news\/[a-z0-9-]+)" class="PublicationList[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = listRe.exec(html)) !== null) {
    const url = normalizeUrl(`https://www.anthropic.com${m[1]}`);
    const inner = m[2];
    const titleM = inner.match(/PublicationList[^"]*__title[^"]*"[^>]*>([^<]+)/);
    const dateM = inner.match(/<time[^>]*>([^<]+)/);
    if (titleM) {
      byUrl.set(url, {
        title: decodeHtmlEntities(titleM[1].trim()),
        published_date: parseDate(dateM?.[1]?.trim()),
      });
    }
  }

  return [...byUrl.entries()].slice(0, maxItems).map(([url, meta], idx) =>
    tagLiveItem({
      item_id: url,
      company,
      source_id: sourceId,
      source_type: sourceType,
      source_level: sourceLevel,
      title: meta.title,
      url,
      published_date: meta.published_date,
      excerpt: excerpt(meta.title, 200),
      fetched_at: fetchedAt,
    }),
  ).filter((i) => i.title && i.url);
}

export async function fetchHtmlListing(url, { timeoutMs = 15000, maxBytes = 2_000_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AgentReadiness-EditorialIntelligence/1.0 (+https://readiness.coaretail.com)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > maxBytes) throw new Error('PAGE_TOO_LARGE');
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch items for a registry source using its configured mode.
 */
export async function fetchSourceItems(source) {
  const profile = SOURCE_FETCH_PROFILES[source.source_id] || {};
  const mode = source.fetch_mode || profile.mode || 'rss';
  const sourceLevel = source.priority === 'A' ? 'A' : 'B';
  const meta = {
    company: source.company,
    sourceId: source.source_id,
    sourceType: source.source_type,
    sourceLevel,
  };

  if (mode === 'html_listing') {
    const listingUrl = source.listing_url || profile.listingUrl || source.url;
    const result = await fetchHtmlListing(listingUrl);
    if (!result.ok) return { ok: false, error: result.error, items: [] };
    const items = parseAnthropicNewsListing(result.text, {
      ...meta,
      maxItems: profile.maxItems || 20,
    });
    return { ok: true, items, mode };
  }

  const feedUrl = source.feed_url || source.url;
  if (mode === 'rss_incremental') {
    const result = await fetchFeedIncremental(feedUrl, {
      maxItems: profile.maxItems || 20,
      maxFeedBytes: profile.maxFeedBytes || source.max_feed_bytes || 800_000,
    });
    if (!result.ok) return { ok: false, error: result.error, items: [] };
    const items = parseFeedItems(result.text, meta);
    return { ok: true, items, mode, truncated: result.truncated };
  }

  const result = await fetchFeed(feedUrl, {
    maxBytes: source.max_feed_bytes || profile.maxFeedBytes || DEFAULT_MAX_FEED_BYTES,
  });
  if (!result.ok) return { ok: false, error: result.error, items: [] };
  const items = parseFeedItems(result.text, meta);
  return { ok: true, items, mode: 'rss' };
}

export function loadBackfillFixtures(fixturesPath) {
  if (!fs.existsSync(fixturesPath)) return [];
  const raw = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
  return tagFixtureItems(raw);
}
