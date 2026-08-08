/**
 * RMVU-02 — Paid product data integrity helpers.
 * Shared between /api/analyze and integrity tests.
 */

export const STRIPE_LINKS = {
  diagnosis: 'https://buy.stripe.com/9B600kecb8iBdMTb5hcMM0g',
  researchCanonical: 'https://buy.stripe.com/dRmdRa1ppgP7107ddpcMM0k',
  researchInconsistent: 'https://buy.stripe.com/00waEY6JJ0Q9bELgpBcMM0j',
  handbookCanonical: 'https://buy.stripe.com/5kQ7sM6JJ0Q99wDehtcMM0i',
};

export const PROTECTED_ABIS_SLUGS = [
  'interaction-contract',
  'consent-data-design',
  'abis-intro',
  'abis-ari-bridge',
  'standards-landscape',
  'abis-readiness-gap',
];

/** Paid flow must not proceed without live AI analysis. */
export function shouldRejectPaidAnalysis({ paid, hasAnyKey, validAICount }) {
  if (!paid) return { reject: false };
  if (!hasAnyKey) {
    return { reject: true, reason: 'missing_api_keys', status: 503 };
  }
  if (!validAICount || validAICount <= 0) {
    return { reject: true, reason: 'ai_query_failed', status: 503 };
  }
  return { reject: false };
}

/** Deterministic certificate number (same inputs → same id). */
export function certNumberDeterministic(form, certification) {
  const levelChar = String(certification || 'B')[0];
  const seed = `${form?.company || ''}|${form?.url || ''}|${levelChar}`;
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  const num = (Math.abs(h) % 900000) + 100000;
  return `ARI-${new Date().getFullYear()}-${levelChar}-${String(num)}`;
}

/**
 * Strip metrics that must not appear on a paid Decision Product
 * (no population-backed rank / deviation / placeholder competitors).
 */
export function applyPaidProductIntegrity(report, form) {
  const next = { ...report };
  delete next.rank;
  delete next.deviation;
  delete next.competitors;
  delete next.knowledgeCoverage;
  delete next.authority;

  if (next.certificate) {
    next.certificate = {
      ...next.certificate,
      number: certNumberDeterministic(form, next.certification),
    };
  }

  next.integrity = {
    productMode: 'paid',
    analysisMode: 'live',
    excludedFields: ['rank', 'deviation', 'competitors', 'knowledgeCoverage', 'authority'],
    provenance: {
      overallScore: 'derived',
      scoreBreakdown: 'derived',
      executiveSummary: 'derived',
      aiRecognition: 'live',
      roadmap: 'derived',
      improvementProposals: 'derived',
      technical: 'live',
      bookingReadiness: 'derived',
      certificate: 'derived',
    },
  };

  return next;
}

export function hasRandomCompetitorNames(competitors) {
  if (!Array.isArray(competitors)) return false;
  return competitors.some((c) => /^競合[A-Z]社$/.test(String(c?.name || '')));
}

export function hasPopulationRankFields(report) {
  return !!(report?.rank || report?.deviation != null);
}
