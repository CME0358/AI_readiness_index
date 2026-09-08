import { ORGANIZATION, OFFERINGS } from '../service-offerings.mjs';
import { AUDIENCES, REFERRAL_CAMPAIGNS, SITE_ORIGIN } from './constants.mjs';

const companyReport = OFFERINGS.find((o) => o.id === 'company_report');
const localGeo = OFFERINGS.find((o) => o.id === 'local_geo');

/**
 * Audience landing routes with UTM — new campaign namespace only.
 * Do not reuse ari_x_traffic or existing /go/ short_ids.
 */
export const LANDING_ROUTES = Object.freeze([
  {
    audience: AUDIENCES.ENTERPRISE,
    id: 'enterprise_report',
    label: '企業向け — Company Report',
    destinationPath: '/report/',
    href: `${SITE_ORIGIN}/report/`,
    consultAlternative: ORGANIZATION.consultUrl,
    offeringId: 'company_report',
    priceNote: `¥${companyReport.priceExTaxYen.toLocaleString('ja-JP')}（税別）`,
  },
  {
    audience: AUDIENCES.ENTERPRISE,
    id: 'enterprise_check',
    label: '企業向け — 無料URL確認',
    destinationPath: '/',
    href: `${SITE_ORIGIN}/`,
    hash: '#company-check',
    offeringId: null,
  },
  {
    audience: AUDIENCES.STORE,
    id: 'store_localgeo',
    label: '店舗向け — Local GEO',
    destinationPath: 'https://localgeo.coaretail.com/',
    href: 'https://localgeo.coaretail.com/',
    external: true,
    offeringId: 'local_geo',
    priceNote: `月額¥${localGeo.priceExTaxYen.toLocaleString('ja-JP')}（税別）`,
  },
  {
    audience: AUDIENCES.STORE,
    id: 'store_case',
    label: '店舗向け — 飲食事例',
    destinationPath: '/cases/bar-secret/',
    href: `${SITE_ORIGIN}/cases/bar-secret/`,
    offeringId: null,
  },
  {
    audience: AUDIENCES.PARTNER,
    id: 'partner_consult',
    label: '協業向け — 無料相談',
    destinationPath: '/readiness/mtgschedule',
    href: ORGANIZATION.consultUrl,
    external: true,
    offeringId: 'advisory',
  },
  {
    audience: AUDIENCES.PARTNER,
    id: 'partner_guides',
    label: '協業向け — 内製/外注ガイド',
    destinationPath: '/guides/inhouse-vs-outsource/',
    href: `${SITE_ORIGIN}/guides/inhouse-vs-outsource/`,
    offeringId: null,
  },
]);

export function buildReferralUrl(route, {
  source = 'referral',
  medium = 'outbound',
  content = '',
} = {}) {
  const campaign = REFERRAL_CAMPAIGNS[route.audience];
  if (!campaign) throw new Error(`Unknown audience: ${route.audience}`);

  const base = route.external ? route.href : `${SITE_ORIGIN}${route.destinationPath.replace(SITE_ORIGIN, '')}`;
  const url = new URL(base);
  url.searchParams.set('utm_source', source);
  url.searchParams.set('utm_medium', medium);
  url.searchParams.set('utm_campaign', campaign);
  if (content) url.searchParams.set('utm_content', content);
  if (route.hash) url.hash = route.hash.replace(/^#/, '');
  return url.toString();
}

export function routesByAudience(audience) {
  return LANDING_ROUTES.filter((r) => r.audience === audience);
}
