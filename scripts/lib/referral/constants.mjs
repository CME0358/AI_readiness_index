/** ARI-P3-01 — referral / external intro constants. */

export const REFERRAL_OWNERSHIP = 'ari_referral_p3';
export const REFERRAL_VERSION = '1.0';
export const SITE_ORIGIN = 'https://readiness.coaretail.com';

export const AUDIENCES = Object.freeze({
  ENTERPRISE: 'enterprise',
  STORE: 'store',
  PARTNER: 'partner',
});

export const REFERRAL_CAMPAIGNS = Object.freeze({
  enterprise: 'ari_ref_enterprise',
  store: 'ari_ref_store',
  partner: 'ari_ref_partner',
});

export const ALLOWED_REFERRAL_HOSTS = Object.freeze([
  'readiness.coaretail.com',
  'www.coaretail.com',
  'localgeo.coaretail.com',
]);

export const MEDIA_SPECS = Object.freeze({
  x: { maxUtf16: 279, requiresShortUrl: true, imageOptional: true },
  linkedin: { maxChars: 3000, requiresShortUrl: false, imageRecommended: true },
  media_kit: { maxChars: 8000, requiresShortUrl: false, imageOptional: true },
  seminar_pitch: { maxChars: 1200, requiresShortUrl: false },
  email_intro: { maxChars: 1500, requiresShortUrl: false },
  case_blurb: { maxChars: 600, requiresShortUrl: false },
});
