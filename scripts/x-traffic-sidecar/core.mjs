import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
export const SIDECAR_VERSION = '1.0';
export const OWNERSHIP = 'ari_x_traffic_sidecar_v1';
export const TIMEZONE = 'Asia/Tokyo';
export const SITE_ORIGIN = 'https://readiness.coaretail.com';
export const INSIGHTS_ORIGIN = `${SITE_ORIGIN}/insights`;
export const SLOTS = Object.freeze([
  { time: '06:00', angle: 'DATA / NEWS', key: 'data-news', label: 'DATA / NEWS' },
  { time: '07:00', angle: 'EXECUTIVE PROBLEM', key: 'executive-problem', label: 'EXECUTIVE PROBLEM' },
  { time: '08:00', angle: 'PRACTICAL', key: 'practical', label: 'PRACTICAL' },
  { time: '15:00', angle: 'DISCOVERY', key: 'discovery', label: 'DISCOVERY' },
  { time: '18:00', angle: 'CONVERSION', key: 'conversion', label: 'CONVERSION' },
]);
export const DEFAULT_COOLDOWN_DAYS = 14;
export const DEFAULT_MAX_UTF16 = 279;

export const SIDECAR_DIR = path.join(ROOT, 'insights/_social/x-sidecar');
export const LEDGER_PATH = path.join(SIDECAR_DIR, 'ledger.json');
export const REDIRECTS_PATH = path.join(SIDECAR_DIR, 'redirects.json');

export function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function ymdJst(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

export function jstIso(ymd, hm) {
  return `${ymd}T${hm}:00+09:00`;
}

export function yymmdd(ymd) {
  return ymd.replaceAll('-', '').slice(2);
}

const URL_TOKEN_LENGTH = 23;
const URL_REGEX = /https?:\/\/[^\s]+/g;

function isWeightedCjk(code) {
  return (
    (code >= 0x1100 && code <= 0x11ff) ||
    (code >= 0x2e80 && code <= 0x9fff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xffef)
  );
}

/** X / Buffer weighted character count (CJK=2, URLs=t.co length). */
export function utf16Length(text) {
  const normalized = String(text).replace(URL_REGEX, 'x'.repeat(URL_TOKEN_LENGTH));
  return [...normalized].reduce((n, char) => {
    const code = char.codePointAt(0);
    if (code > 0xffff) return n + 2;
    return n + (isWeightedCjk(code) ? 2 : 1);
  }, 0);
}

export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

export function expectedArticleUrl(slug) {
  return `${INSIGHTS_ORIGIN}/${encodeURIComponent(slug)}/`;
}

function stripHtml(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function meta(html, key, attr = 'name') {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const wanted = tags.find((tag) => {
    const value = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'))?.[1];
    return value?.toLowerCase() === key.toLowerCase();
  });
  return wanted?.match(/content=["']([^"']*)["']/i)?.[1] || null;
}

function firstMatch(html, re) {
  return html.match(re)?.[1]?.trim() || null;
}

export function parseInsight(slug, html, { root = ROOT } = {}) {
  const canonical = firstMatch(html, /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const title = firstMatch(html, /<title>([\s\S]*?)<\/title>/i)?.replace(/\s*\|\s*Agent Readiness Insights\s*$/, '') ||
    meta(html, 'og:title', 'property');
  const description = meta(html, 'description') || meta(html, 'og:description', 'property') || '';
  const published = firstMatch(html, /"datePublished"\s*:\s*"([0-9]{4}-[0-9]{2}-[0-9]{2})"/i) ||
    firstMatch(html, /<time\b[^>]*datetime=["']([0-9-]{10})["']/i);
  const heroUrl = meta(html, 'og:image', 'property');
  const twitterImage = meta(html, 'twitter:image');
  const articleType = firstMatch(html, /data-editorial-type=["']([^"']+)["']/i) ||
    firstMatch(html, /<span[^>]*class=["'][^"']*article-tag[^"']*["'][^>]*>([^<]+)</i) || 'evergreen';
  const lead = firstMatch(html, /<p\b[^>]*class=["'][^"']*lead[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
  const body = stripHtml(html);
  const heroLocal = path.join(root, 'assets', 'insights', slug, 'hero.webp');
  return {
    article_id: slug,
    slug,
    title: stripHtml(title || slug),
    canonical_url: canonical,
    publication_date: published,
    summary: stripHtml(lead || description || body.slice(0, 500)),
    article_body: body,
    hero_url: heroUrl,
    og_image: heroUrl,
    twitter_image: twitterImage,
    category: articleType,
    hero_local: heroLocal,
    hero_available: fs.existsSync(heroLocal),
    public: true,
    http_status: 200,
    source_html: html,
  };
}

export function loadPublishedInsights({ root = ROOT } = {}) {
  const dir = path.join(root, 'insights');
  const rows = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const htmlPath = path.join(dir, entry.name, 'index.html');
    if (!fs.existsSync(htmlPath)) continue;
    rows.push(parseInsight(entry.name, fs.readFileSync(htmlPath, 'utf8'), { root }));
  }
  return rows;
}

export function eligibleArticle(article, targetYmd, { verifiedSlugs = null } = {}) {
  const expected = expectedArticleUrl(article.slug);
  const errors = [];
  if (!article.public) errors.push('ARTICLE_NOT_PUBLIC');
  if (article.http_status !== 200) errors.push('ARTICLE_HTTP_NOT_200');
  if (normalizeUrl(article.canonical_url) !== expected) errors.push('CANONICAL_MISMATCH');
  if (!article.publication_date || article.publication_date > targetYmd) errors.push('FUTURE_DATED');
  if (!article.hero_available) errors.push('HERO_UNAVAILABLE');
  if (article.hero_url !== `${SITE_ORIGIN}/assets/insights/${encodeURIComponent(article.slug)}/hero.webp`) {
    errors.push('HERO_NOT_CANONICAL');
  }
  if (article.twitter_image !== article.hero_url) errors.push('TWITTER_IMAGE_MISMATCH');
  if (verifiedSlugs && !verifiedSlugs.has(article.slug)) errors.push('PRODUCTION_NOT_VERIFIED');
  return { ok: errors.length === 0, errors };
}

function daysBetween(a, b) {
  return Math.floor((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function topic(article) {
  const text = `${article.category} ${article.title} ${article.summary}`.toLowerCase();
  if (/価格|決済|予約|購入|action/.test(text)) return 'actionability';
  if (/検索|推薦|比較|visibility|ai検索/.test(text)) return 'ai-discovery';
  if (/信頼|authority|レビュー|根拠/.test(text)) return 'authority';
  if (/組織|運用|マーケ|marketing|人間|agent/.test(text)) return 'operations';
  return article.category || 'evergreen';
}

export function selectArticles(articles, { date, ledger = { posts: [] }, cooldownDays = DEFAULT_COOLDOWN_DAYS, verifiedSlugs = null } = {}) {
  const prior = ledger.posts || ledger.entries || [];
  const recent = new Map();
  for (const post of prior) {
    if (!post.article_slug || !post.date) continue;
    const current = recent.get(post.article_slug);
    if (!current || post.date > current) recent.set(post.article_slug, post.date);
  }
  const sameDay = new Set(prior.filter((p) => p.date === date).map((p) => p.article_slug));
  const eligible = articles
    .map((article) => ({ article, check: eligibleArticle(article, date, { verifiedSlugs }) }))
    .filter(({ article, check }) => check.ok && !sameDay.has(article.slug))
    .sort((a, b) => {
      const aRecent = recent.get(a.article.slug);
      const bRecent = recent.get(b.article.slug);
      const aCooldown = aRecent ? daysBetween(aRecent, date) < cooldownDays : false;
      const bCooldown = bRecent ? daysBetween(bRecent, date) < cooldownDays : false;
      if (aCooldown !== bCooldown) return Number(aCooldown) - Number(bCooldown);
      return String(b.article.publication_date).localeCompare(String(a.article.publication_date));
    });
  const chosen = [];
  const usedTopics = new Set();
  for (const row of eligible) {
    if (chosen.length >= SLOTS.length) break;
    const t = topic(row.article);
    if (usedTopics.has(t) && eligible.length - eligible.indexOf(row) > SLOTS.length - chosen.length) continue;
    chosen.push({ ...row, topic: t });
    usedTopics.add(t);
  }
  return { chosen, eligibleCount: eligible.length, usedTopics: [...usedTopics] };
}

function trimTo(text, max) {
  if (utf16Length(text) <= max) return text;
  let out = '';
  for (const char of text) {
    if (utf16Length(`${out}${char}…`) > max) break;
    out += char;
  }
  return `${out}…`;
}

function fact(article) {
  const s = article.summary.replace(/[。！？]+$/u, '');
  return s || article.title;
}

export function generatePost(article, slot, shortUrl, { maxUtf16 = DEFAULT_MAX_UTF16 } = {}) {
  const f = fact(article);
  const templates = {
    'data-news': `数字の変化より、意思決定の変化を見る。\n\n${f}。AIに見つかるだけでなく、比較・推薦・行動まで追える設計が必要です。`,
    'executive-problem': `経営課題は「AIに出るか」だけではありません。\n\n${f}。候補に入り、根拠を持って選ばれ、次の行動につながる状態をどう測るかが問われます。`,
    practical: `実務で見るべきは3点です。\n\n1. AIが正しく理解できるか\n2. 比較の根拠が揃っているか\n3. 予約・相談まで進めるか\n\n${f}。`,
    discovery: `まだ見落とされがちな論点。\n\n${f}。検索順位の外側で、企業がどう理解され、推薦されるかを整理しています。`,
    conversion: `AI時代の集客を見直すなら、まず自社のVisibility・Authority・Actionabilityを確認する。\n\n${f}。ARI Insightsで論点を確認できます。`,
  };
  const hashtags = slot.key === 'conversion' ? '#AgentReadiness' : '#AgentReadiness #AI';
  const footer = `\n\n${shortUrl}\n${hashtags}`;
  const body = trimTo(templates[slot.key], maxUtf16 - utf16Length(footer));
  return `${body}${footer}`;
}

export function buildShortId(date, index) {
  return `x${yymmdd(date)}${String.fromCharCode(97 + index)}`;
}

export function buildDestination(article, date, slot) {
  const url = new URL(expectedArticleUrl(article.slug));
  url.searchParams.set('utm_source', 'x');
  url.searchParams.set('utm_medium', 'organic');
  url.searchParams.set('utm_campaign', 'ari_x_traffic');
  url.searchParams.set('utm_content', `${yymmdd(date)}_${slot.time.replace(':', '')}`);
  return url.toString();
}

export function validateDestination(destination) {
  try {
    const u = new URL(destination);
    return u.protocol === 'https:' && u.hostname === 'readiness.coaretail.com' &&
      /^\/insights\/[a-z0-9-]+\/$/.test(u.pathname) &&
      u.searchParams.get('utm_source') === 'x' &&
      u.searchParams.get('utm_medium') === 'organic' &&
      u.searchParams.get('utm_campaign') === 'ari_x_traffic' &&
      Boolean(u.searchParams.get('utm_content'));
  } catch {
    return false;
  }
}

export function planDay({ date, articles, ledger, redirects = { redirects: [] }, cooldownDays = DEFAULT_COOLDOWN_DAYS, verifiedSlugs = null, maxUtf16 = DEFAULT_MAX_UTF16 } = {}) {
  const selection = selectArticles(articles, { date, ledger, cooldownDays, verifiedSlugs });
  const ledgerShortIds = new Set((ledger?.posts || []).map((post) => post.short_id).filter(Boolean));
  const usedShortIds = new Set(ledgerShortIds);
  for (const redirect of redirects?.redirects || []) {
    if (!redirect?.short_id || ledgerShortIds.has(redirect.short_id)) continue;
    // Same-day redirects are recoverable from a prior partial delivery attempt.
    if (redirect.date === date) continue;
    usedShortIds.add(redirect.short_id);
  }
  const posts = SLOTS.map((slot, index) => {
    const selected = selection.chosen[index];
    if (!selected) return {
      slot: slot.time, angle: slot.angle, state: 'HOLD', error_code: 'INSUFFICIENT_ELIGIBLE_ARTICLES',
    };
    const shortId = buildShortId(date, index);
    const alreadyLedgered = (ledger?.posts || []).some(
      (post) => post.short_id === shortId && post.date === date && post.slot === slot.time,
    );
    const collision = !alreadyLedgered && usedShortIds.has(shortId);
    usedShortIds.add(shortId);
    const shortUrl = `${SITE_ORIGIN}/go/${shortId}`;
    const destination = buildDestination(selected.article, date, slot);
    const generatedText = generatePost(selected.article, slot, shortUrl, { maxUtf16 });
    return {
      sidecar_post_id: `ari-x-${date}-${slot.time.replace(':', '')}`,
      date,
      slot: slot.time,
      scheduled_at: jstIso(date, slot.time),
      article_slug: selected.article.slug,
      article_title: selected.article.title,
      article_url: expectedArticleUrl(selected.article.slug),
      content_angle: slot.angle,
      generated_text: generatedText,
      short_id: shortId,
      short_url: shortUrl,
      destination_url: destination,
      hero_url: selected.article.hero_url,
      topic: selected.topic,
      state: collision ? 'HOLD' : 'GENERATED',
      error_code: collision ? 'SHORT_URL_COLLISION' : null,
      ownership: OWNERSHIP,
      validation: {
        article: selected.check.errors.length === 0,
        canonical: normalizeUrl(selected.article.canonical_url) === expectedArticleUrl(selected.article.slug),
        hero: selected.article.hero_available,
        short_url_unique: !collision,
        redirect_target_valid: validateDestination(destination),
        utf16_length: utf16Length(generatedText),
        x_length_valid: utf16Length(generatedText) <= maxUtf16,
      },
    };
  });
  return { date, timezone: TIMEZONE, sidecar_version: SIDECAR_VERSION, selection, posts };
}

export function assertOwnership(entry, remoteId) {
  return Boolean(entry && entry.ownership === OWNERSHIP && entry.buffer_post_id && entry.buffer_post_id === remoteId);
}

export function validateRedirectRequest(entry) {
  return Boolean(entry && typeof entry.short_id === 'string' && /^[a-z0-9-]{4,64}$/.test(entry.short_id) && validateDestination(entry.destination));
}

export function evaluateCapacity({ scheduledCount, requestedCount, organizationLimit, dailyLimit }) {
  if (!Number.isInteger(scheduledCount) || !Number.isInteger(requestedCount) || organizationLimit == null || !dailyLimit) {
    return { status: 'CAPACITY_UNKNOWN', safe: false };
  }
  const orgSafe = scheduledCount + requestedCount <= organizationLimit;
  const dailySafe = dailyLimit.limit == null || dailyLimit.scheduled + dailyLimit.sent + requestedCount <= dailyLimit.limit;
  const safe = orgSafe && dailySafe && !dailyLimit.isAtLimit;
  return { status: safe ? 'PASS' : 'BUFFER_QUEUE_UNSAFE', safe, orgSafe, dailySafe };
}
