import { ARTICLE_BASE_URL } from './insights-v2-paths.mjs';

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;

export async function verifyArticleUrl(slug, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = `${ARTICLE_BASE_URL}/${slug}/`;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'ARI-Insights-v2/1.0' },
      });
      if (res.status !== 200) {
        lastError = `HTTP ${res.status}`;
        continue;
      }
      const html = await res.text();
      const checks = validateArticleHtml(html, slug, url);
      if (!checks.ok) {
        lastError = checks.reason;
        continue;
      }
      return { ok: true, url, status: res.status, checks };
    } catch (err) {
      lastError = err.name === 'AbortError' ? 'timeout' : String(err.message || err);
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, url, reason: lastError || 'unknown' };
}

export function validateArticleHtml(html, slug, expectedCanonical) {
  if (/noindex/i.test(html) && /meta[^>]+noindex/i.test(html)) {
    return { ok: false, reason: 'noindex detected' };
  }
  const canonicalMatch = html.match(/rel="canonical"\s+href="([^"]+)"/i);
  if (canonicalMatch && canonicalMatch[1] !== expectedCanonical) {
    return { ok: false, reason: `canonical mismatch: ${canonicalMatch[1]}` };
  }
  if (!html.includes('<h1')) {
    return { ok: false, reason: 'missing h1' };
  }
  if (html.includes('article-cta') === false) {
    return { ok: false, reason: 'missing article-cta' };
  }
  return { ok: true, slug };
}
