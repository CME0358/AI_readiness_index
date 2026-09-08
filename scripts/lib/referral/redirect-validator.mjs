import { ALLOWED_REFERRAL_HOSTS, REFERRAL_CAMPAIGNS } from './constants.mjs';

export function validateReferralDestination(destination) {
  try {
    const u = new URL(destination);
    if (u.protocol !== 'https:') return false;
    if (!ALLOWED_REFERRAL_HOSTS.includes(u.hostname)) return false;

    const campaign = u.searchParams.get('utm_campaign') || '';
    const source = u.searchParams.get('utm_source');
    const medium = u.searchParams.get('utm_medium');
    const content = u.searchParams.get('utm_content');
    if (!source || !medium || !content) return false;

    const validCampaign = Object.values(REFERRAL_CAMPAIGNS).includes(campaign)
      || campaign === 'ari_referral_p3';
    if (!validCampaign) return false;

    if (u.hostname === 'readiness.coaretail.com') {
      const path = u.pathname;
      const allowed = path === '/'
        || path === '/improve.html'
        || path.startsWith('/report/')
        || path.startsWith('/cases/')
        || path.startsWith('/guides/')
        || path.startsWith('/services/')
        || path.startsWith('/sample/')
        || path.startsWith('/insights/');
      if (!allowed) return false;
    }

    if (u.hostname === 'www.coaretail.com') {
      if (!u.pathname.startsWith('/readiness/mtgschedule')) return false;
    }

    if (u.hostname === 'localgeo.coaretail.com') {
      if (u.pathname !== '/' && u.pathname !== '') return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function assertNoSidecarShortIdCollision(referralIds, sidecarIds) {
  const overlap = referralIds.filter((id) => sidecarIds.includes(id));
  return { ok: overlap.length === 0, overlap };
}
