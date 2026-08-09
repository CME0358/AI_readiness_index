import { CLAIM_CLASSES } from './constants.mjs';
import { containsAbisContent } from './abis-guard.mjs';

export function buildClaimMap(event) {
  const src = event.primary_source || {};
  const claims = [
    {
      claim: `${event.company} published: ${event.title}`,
      source_url: event.url || src.url,
      source_type: src.source_type || 'official_blog',
      source_date: event.published_date,
      confidence: CLAIM_CLASSES.VERIFIED,
    },
  ];
  if (event.excerpt) {
    claims.push({
      claim: event.excerpt,
      source_url: event.url || src.url,
      source_type: src.source_type || 'official_blog',
      source_date: event.published_date,
      confidence: CLAIM_CLASSES.VERIFIED,
    });
  }
  claims.push({
    claim: 'ARI interpretation of business/readiness impact is analytical, not official vendor guidance.',
    source_url: 'https://readiness.coaretail.com/framework/',
    source_type: 'ari_framework',
    source_date: null,
    confidence: CLAIM_CLASSES.ARI_INTERPRETATION,
  });
  return claims;
}

export function validateClaims(claims) {
  const blocked = [];
  const verified = [];
  const inference = [];
  for (const c of claims) {
    if (containsAbisContent(c.claim)) {
      blocked.push({ ...c, reason: 'ABIS_BLOCKED' });
      continue;
    }
    if (!c.source_url && c.confidence === CLAIM_CLASSES.VERIFIED) {
      blocked.push({ ...c, reason: 'MISSING_SOURCE_URL' });
      continue;
    }
    if (c.confidence === CLAIM_CLASSES.VERIFIED) verified.push(c);
    else if (c.confidence === CLAIM_CLASSES.INFERENCE) inference.push(c);
    else verified.push(c);
  }
  return { blocked, verified, inference, ok: blocked.length === 0 };
}

/** Reject drafts with unsupported causal claims or invented metrics. */
export function validateDraftText(text) {
  const issues = [];
  if (/5\.5倍|5\.5x/i.test(text)) issues.push('UNSUPPORTED_MULTIPLIER');
  if (/必ず|確実に|間違いなく.*改善/i.test(text)) issues.push('UNSUPPORTED_URGENCY');
  if (/当社調査では.*\d{3,}%/.test(text) && !/97\.8|15\.6|100問|231/.test(text)) {
    issues.push('UNSUPPORTED_METRIC');
  }
  if (containsAbisContent(text)) issues.push('ABIS_LEAK');
  return { ok: issues.length === 0, issues };
}
