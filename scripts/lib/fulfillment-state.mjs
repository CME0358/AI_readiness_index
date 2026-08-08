/**
 * RMVU-03 — Paid fulfillment state, TTL persistence, purchase verification helpers.
 */

import {
  PRODUCTS,
  RESEARCH_EDITION,
  HANDBOOK,
  mergeEntitlements,
  getProductById,
  getProductBySku,
} from './product-catalog.mjs';

export const STORAGE_KEYS = {
  purchase: 'ari_purchase_state',
  reportCache: 'ari_report_cache',
  pendingForm: 'ari_pending_form',
  reportSummary: 'ari_report_summary',
};

/** Report cache TTL — 72h balances reload recovery vs PII retention risk. */
export const REPORT_CACHE_TTL_MS = 72 * 60 * 60 * 1000;

/** Purchase entitlement record TTL — same window; re-verify via session if expired. */
export const PURCHASE_STATE_TTL_MS = 72 * 60 * 60 * 1000;

export function nowMs() {
  return Date.now();
}

export function expiresAt(ttlMs = REPORT_CACHE_TTL_MS) {
  return nowMs() + ttlMs;
}

export function isExpired(record) {
  if (!record?.expiresAt) return true;
  return nowMs() > record.expiresAt;
}

export function createPurchaseState({
  sessionId = null,
  productId,
  fulfillmentState,
  entitlements,
  verified = false,
  verificationMethod = 'unknown',
}) {
  return {
    sessionId,
    productId,
    fulfillmentState,
    entitlements: entitlements || { companyReport: false, researchEdition: false, methodologyHandbook: false },
    verified,
    verificationMethod,
    purchasedAt: nowMs(),
    expiresAt: expiresAt(PURCHASE_STATE_TTL_MS),
  };
}

export function createReportCache({ report, form }) {
  return {
    report,
    form: form ? { company: form.company, url: form.url, industry: form.industry, email: form.email } : null,
    savedAt: nowMs(),
    expiresAt: expiresAt(REPORT_CACHE_TTL_MS),
  };
}

export function sanitizePurchaseForStorage(state) {
  if (!state) return null;
  return {
    sessionId: state.sessionId || null,
    productId: state.productId || null,
    fulfillmentState: state.fulfillmentState || 'UNKNOWN',
    entitlements: state.entitlements || {},
    verified: !!state.verified,
    verificationMethod: state.verificationMethod || 'unknown',
    purchasedAt: state.purchasedAt || nowMs(),
    expiresAt: state.expiresAt || expiresAt(PURCHASE_STATE_TTL_MS),
  };
}

/** Resolve product from Stripe Checkout Session (server-side). */
export function resolveProductFromStripeSession(session, productHint) {
  if (!session || session.payment_status !== 'paid') return null;

  const amount = session.amount_total;
  const hint = productHint || session.metadata?.product_sku || session.client_reference_id;

  if (hint) {
    const bySku = getProductBySku(String(hint));
    if (bySku && bySku.priceTaxIncl === amount) return bySku;
    const byId = getProductById(String(hint));
    if (byId && byId.priceTaxIncl === amount) return byId;
  }

  const matches = Object.values(PRODUCTS).filter((p) => p.priceTaxIncl === amount);
  if (matches.length === 1) return matches[0];

  if (amount === PRODUCTS.companyReportLegacy.priceTaxIncl) {
    if (hint === 'research_edition' || hint === PRODUCTS.researchEdition.id) {
      return PRODUCTS.researchEdition;
    }
    return PRODUCTS.companyReportLegacy;
  }

  if (amount === PRODUCTS.handbookFull.priceTaxIncl) return PRODUCTS.handbookFull;
  if (amount === PRODUCTS.handbookUpgrade.priceTaxIncl) return PRODUCTS.handbookUpgrade;

  return null;
}

export function buildVerifiedPurchaseState(session, product) {
  return createPurchaseState({
    sessionId: session.id,
    productId: product.id,
    fulfillmentState: product.fulfillmentState,
    entitlements: { ...product.entitlements },
    verified: true,
    verificationMethod: 'stripe_api',
  });
}

/** Legacy: paid=1 query without server verify — limited trust, still enables retry. */
export function buildLegacyPurchaseState(productId = PRODUCTS.companyReportLegacy.id) {
  const product = getProductById(productId) || PRODUCTS.companyReportLegacy;
  return createPurchaseState({
    sessionId: null,
    productId: product.id,
    fulfillmentState: product.fulfillmentState,
    entitlements: { ...product.entitlements },
    verified: false,
    verificationMethod: 'legacy_query',
  });
}

export function grantBrowserEntitlements(entitlements, sessionId, storage = {}) {
  const granted = [];
  if (entitlements?.researchEdition && storage.sessionStorage) {
    try {
      storage.sessionStorage.setItem(RESEARCH_EDITION.storageKey, sessionId || 'company_report');
      granted.push('researchEdition');
    } catch { /* noop */ }
  }
  if (entitlements?.methodologyHandbook && storage.sessionStorage) {
    try {
      storage.sessionStorage.setItem(HANDBOOK.storageKey, sessionId || 'handbook');
      granted.push('methodologyHandbook');
    } catch { /* noop */ }
  }
  return granted;
}

export function hasActivePurchase(purchaseState) {
  return !!(purchaseState && !isExpired(purchaseState) && purchaseState.entitlements?.companyReport);
}

export function canRetryAnalysis(purchaseState) {
  return hasActivePurchase(purchaseState);
}

export function mergePurchaseEntitlements(existing, incoming) {
  if (!existing || isExpired(existing)) return incoming;
  return {
    ...existing,
    entitlements: mergeEntitlements(existing.entitlements, incoming.entitlements),
    verified: existing.verified || incoming.verified,
    verificationMethod: incoming.verified ? incoming.verificationMethod : existing.verificationMethod,
    expiresAt: Math.max(existing.expiresAt || 0, incoming.expiresAt || 0),
  };
}
