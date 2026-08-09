/**
 * RMVU-03 — Canonical product matrix & Stripe Payment Link registry.
 * Single source of truth (server + tests). Browser mirror: assets/product-catalog.js
 */

export const FULFILLMENT_STATES = {
  FREE: 'FREE',
  PAID_COMPANY_REPORT: 'PAID_COMPANY_REPORT',
  PAID_HANDBOOK_FULL: 'PAID_HANDBOOK_FULL',
  PAID_HANDBOOK_UPGRADE: 'PAID_HANDBOOK_UPGRADE',
  DEMO: 'DEMO',
  UNKNOWN: 'UNKNOWN',
};

/** Tax-inclusive amounts (JPY) for Stripe session validation. */
export const STRIPE_AMOUNT_TAX_INCL = {
  companyReport: 32_780,
  researchEdition: 32_780,
  handbookFull: 107_800,
  handbookUpgrade: 75_900,
};

export const PRODUCTS = {
  companyReportLegacy: {
    id: 'company_report_legacy',
    sku: 'company_report',
    name: 'Agent Readiness Company Report',
    priceExTax: 29_800,
    priceTaxIncl: STRIPE_AMOUNT_TAX_INCL.companyReport,
    paymentLink: 'https://buy.stripe.com/9B600kecb8iBdMTb5hcMM0g',
    fulfillmentState: FULFILLMENT_STATES.PAID_COMPANY_REPORT,
    entitlements: {
      companyReport: true,
      researchEdition: true,
      methodologyHandbook: false,
    },
    legacy: true,
    successUrlPattern: '/report/',
  },
  companyReportBundle: {
    id: 'company_report_bundle',
    sku: 'company_report',
    name: 'Agent Readiness Company Report (Bundle)',
    priceExTax: 29_800,
    priceTaxIncl: STRIPE_AMOUNT_TAX_INCL.companyReport,
    /** Set via env COMPANY_REPORT_BUNDLE_PAYMENT_URL when Stripe Dashboard link exists. */
    paymentLink: null,
    fulfillmentState: FULFILLMENT_STATES.PAID_COMPANY_REPORT,
    entitlements: {
      companyReport: true,
      researchEdition: true,
      methodologyHandbook: false,
    },
    requiresNewPaymentLink: true,
    successUrlPattern: '/report/',
  },
  researchEdition: {
    id: 'research_edition',
    sku: 'research_edition',
    name: 'Agent Readiness Research Edition',
    priceExTax: 29_800,
    priceTaxIncl: STRIPE_AMOUNT_TAX_INCL.researchEdition,
    paymentLink: 'https://buy.stripe.com/dRmdRa1ppgP7107ddpcMM0k',
    fulfillmentState: FULFILLMENT_STATES.UNKNOWN,
    entitlements: {
      companyReport: false,
      researchEdition: true,
      methodologyHandbook: false,
    },
    legacyStandalone: true,
    successUrlPattern: '/whitepaper/2026/research/thanks.html',
  },
  handbookFull: {
    id: 'handbook_full',
    sku: 'handbook_full',
    name: 'Agent Readiness Methodology Handbook',
    priceExTax: 98_000,
    priceTaxIncl: STRIPE_AMOUNT_TAX_INCL.handbookFull,
    paymentLink: 'https://buy.stripe.com/5kQ7sM6JJ0Q99wDehtcMM0i',
    fulfillmentState: FULFILLMENT_STATES.PAID_HANDBOOK_FULL,
    entitlements: {
      companyReport: false,
      researchEdition: true,
      methodologyHandbook: true,
    },
    successUrlPattern: '/whitepaper/2026/handbook/thanks.html',
  },
  handbookUpgrade: {
    id: 'handbook_upgrade',
    sku: 'handbook_upgrade',
    name: 'Agent Readiness Methodology Handbook (Upgrade)',
    priceExTax: 69_000,
    priceTaxIncl: STRIPE_AMOUNT_TAX_INCL.handbookUpgrade,
    paymentLink: 'https://buy.stripe.com/00waEY6JJ0Q9bELgpBcMM0j',
    fulfillmentState: FULFILLMENT_STATES.PAID_HANDBOOK_UPGRADE,
    entitlements: {
      companyReport: true,
      researchEdition: true,
      methodologyHandbook: true,
    },
    upgradeForExistingCompanyReport: true,
    successUrlPattern: '/whitepaper/2026/handbook/thanks.html',
  },
};

export const RESEARCH_EDITION = {
  pdfPath: '/whitepaper/2026/research/assets/ARI_Research_Report_2026.pdf',
  /** Legacy standalone Stripe success page — do not use for Company Report bundle. */
  thanksPath: '/whitepaper/2026/research/thanks.html',
  /** Company Report bundle entitlement download (localStorage source of truth). */
  bundleDownloadPath: '/whitepaper/2026/research/download.html',
  readPath: '/whitepaper/2026/research/index.html',
  legacyCheckoutPath: '/whitepaper/2026/research/checkout.html',
  storageKey: 'wp_research_paid',
};

export const HANDBOOK = {
  pdfPath: '/whitepaper/2026/handbook/assets/ARI_Methodology_Handbook_2026.pdf',
  thanksPath: '/whitepaper/2026/handbook/thanks.html',
  storageKey: 'wp_handbook_paid',
};

/** Bundle payment URL from env (server) or null until Dashboard link is created. */
export function resolveBundlePaymentLink(env = process.env) {
  const url = (env.COMPANY_REPORT_BUNDLE_PAYMENT_URL || '').trim();
  return url || null;
}

/** Checkout URL for Company Report — bundle preferred, legacy fallback (never silent if bundle required). */
export function resolveCompanyReportPaymentLink(options = {}) {
  const bundleUrl = resolveBundlePaymentLink(options.env);
  if (bundleUrl) return { url: bundleUrl, productId: PRODUCTS.companyReportBundle.id, source: 'bundle' };
  if (options.allowLegacy !== false) {
    return {
      url: PRODUCTS.companyReportLegacy.paymentLink,
      productId: PRODUCTS.companyReportLegacy.id,
      source: 'legacy',
      bundleLinkRequired: true,
    };
  }
  return { url: null, productId: null, source: 'none', bundleLinkRequired: true };
}

export function getProductBySku(sku) {
  return Object.values(PRODUCTS).find((p) => p.sku === sku) || null;
}

export function getProductById(id) {
  return PRODUCTS[id] || Object.values(PRODUCTS).find((p) => p.id === id) || null;
}

export function mergeEntitlements(base, extra) {
  return {
    companyReport: !!(base?.companyReport || extra?.companyReport),
    researchEdition: !!(base?.researchEdition || extra?.researchEdition),
    methodologyHandbook: !!(base?.methodologyHandbook || extra?.methodologyHandbook),
  };
}
