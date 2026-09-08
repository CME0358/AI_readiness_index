import { buildReferralUrl, LANDING_ROUTES } from './landing-routes.mjs';
import { REFERRAL_OWNERSHIP, REFERRAL_VERSION } from './constants.mjs';
import { POST_DRAFTS } from './post-drafts.mjs';

function routeById(id) {
  return LANDING_ROUTES.find((r) => r.id === id);
}

/** Pre-built referral redirects — NEW short_ids only (prefix ref). */
export function buildReferralRedirects() {
  const mappings = [
    { short_id: 'ref2609e1', routeId: 'enterprise_report', content: 'p3_ent_report', source: 'referral', medium: 'outbound' },
    { short_id: 'ref2609e2', routeId: 'enterprise_check', content: 'p3_ent_check', source: 'referral', medium: 'outbound' },
    { short_id: 'ref2609s1', routeId: 'store_localgeo', content: 'p3_store_localgeo', source: 'referral', medium: 'outbound' },
    { short_id: 'ref2609c1', routeId: 'store_case', content: 'p3_store_case', source: 'referral', medium: 'outbound' },
    { short_id: 'ref2609p1', routeId: 'partner_consult', content: 'p3_partner_consult', source: 'referral', medium: 'partner' },
    { short_id: 'ref2609p2', routeId: 'partner_guides', content: 'p3_partner_guides', source: 'referral', medium: 'partner' },
  ];

  return {
    referral_version: REFERRAL_VERSION,
    ownership: REFERRAL_OWNERSHIP,
    note: 'P3-01 referral campaign — do not reuse x-sidecar short_ids',
    redirects: mappings.map((m) => {
      const route = routeById(m.routeId);
      return {
        short_id: m.short_id,
        audience: route.audience,
        label: route.label,
        destination: buildReferralUrl(route, {
          source: m.source,
          medium: m.medium,
          content: m.content,
        }),
        ownership: REFERRAL_OWNERSHIP,
        status: 'approved_pending_publish',
      };
    }),
  };
}

export function shortUrlForDraft(draftId) {
  const draft = POST_DRAFTS.find((d) => d.id === draftId);
  if (!draft?.shortId) return null;
  return `https://readiness.coaretail.com/go/${draft.shortId}`;
}
