/**
 * Canonical Insights social media policy.
 *
 * Buffer fetches hosted media at publish time, so the only durable media
 * source is the public canonical hero.webp URL. No local upload or social
 * derivative is used when the canonical URL is available.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './insights-v2-paths.mjs';

export const SITE_ORIGIN = 'https://readiness.coaretail.com';
export const SOCIAL_DERIVATIVE_REQUIRED = false;

export function canonicalHeroPath(slug, root = ROOT) {
  return path.join(root, 'assets', 'insights', slug, 'hero.webp');
}

export function canonicalHeroUrl(slug) {
  return `${SITE_ORIGIN}/assets/insights/${encodeURIComponent(slug)}/hero.webp`;
}

export function resolveCanonicalHero(slug, { root = ROOT } = {}) {
  const localPath = canonicalHeroPath(slug, root);
  if (!fs.existsSync(localPath)) {
    return {
      available: false,
      localPath,
      publicUrl: canonicalHeroUrl(slug),
      reason: 'hero_missing',
    };
  }
  return {
    available: true,
    localPath,
    publicUrl: canonicalHeroUrl(slug),
    derivativeRequired: SOCIAL_DERIVATIVE_REQUIRED,
  };
}

function hasMetaImage(html, property, url) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  return tags.some((tag) => {
    const named = tag.match(/(?:property|name)=["']([^"']+)["']/i)?.[1];
    const content = tag.match(/content=["']([^"']+)["']/i)?.[1];
    return named?.toLowerCase() === property.toLowerCase() && content === url;
  });
}

/**
 * Read-only production gate for visual Buffer handoff.
 * A canonical hero is required for the Insights Buffer handoff. This keeps
 * a failed visual step recoverable as pending rather than silently queuing a
 * text-only post; a later reconciliation can retry after the hero is live.
 */
export async function verifyProductionSocialAssets(
  slug,
  { verifyArticle, fetchFn = fetch, root = ROOT } = {}
) {
  const source = resolveCanonicalHero(slug, { root });
  const articleCheck = await verifyArticle(slug);
  if (!articleCheck?.ok) {
    return { ok: false, reason: 'production_not_verified', article: articleCheck, source };
  }

  if (!source.available) {
    return {
      ok: false,
      reason: source.reason,
      mediaUrl: null,
      derivativeRequired: false,
      mediaStatus: source.reason,
      article: articleCheck,
      source,
    };
  }

  const articleHtml = articleCheck.html || '';
  const heroRes = await fetchFn(source.publicUrl, { method: 'GET', redirect: 'follow' });
  if (heroRes.status !== 200) {
    return { ok: false, reason: `hero_http_${heroRes.status}`, article: articleCheck, source };
  }

  if (articleHtml && !articleHtml.includes(source.publicUrl)) {
    return { ok: false, reason: 'canonical_hero_not_referenced', article: articleCheck, source };
  }
  if (articleHtml && !hasMetaImage(articleHtml, 'og:image', source.publicUrl)) {
    return { ok: false, reason: 'og_image_not_canonical_hero', article: articleCheck, source };
  }
  if (articleHtml && !hasMetaImage(articleHtml, 'twitter:image', source.publicUrl)) {
    return { ok: false, reason: 'twitter_image_not_canonical_hero', article: articleCheck, source };
  }

  return {
    ok: true,
    mediaUrl: source.publicUrl,
    derivativeRequired: false,
    mediaStatus: 'canonical_hero_verified',
    article: articleCheck,
    source,
  };
}
