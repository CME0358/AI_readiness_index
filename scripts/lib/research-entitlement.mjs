/**
 * RMVU-03B — Research Edition entitlement resolution.
 * Company Report bundle: localStorage ari_purchase_state (source of truth).
 * Legacy standalone: sessionStorage wp_research_paid (+ Stripe thanks redirect).
 */

import { RESEARCH_EDITION } from './product-catalog.mjs';
import { STORAGE_KEYS, isExpired } from './fulfillment-state.mjs';

export { RESEARCH_EDITION };

export function parsePurchaseState(raw) {
  if (!raw) return null;
  try {
    const state = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!state || isExpired(state)) return null;
    return state;
  } catch {
    return null;
  }
}

/** Company Report / bundle purchase — localStorage is primary. */
export function hasBundleResearchEntitlement(localStorageValue) {
  const state = parsePurchaseState(localStorageValue);
  return !!(state?.entitlements?.researchEdition);
}

/** Legacy Research standalone — sessionStorage after Stripe thanks. */
export function hasLegacyResearchEntitlement(sessionStorageValue) {
  return !!sessionStorageValue;
}

export function resolveResearchEntitlement({
  purchaseStateRaw = null,
  legacySessionValue = null,
} = {}) {
  const purchase = parsePurchaseState(purchaseStateRaw);
  if (purchase?.entitlements?.researchEdition) {
    return {
      ok: true,
      source: 'company_report_bundle',
      purchase,
    };
  }
  if (legacySessionValue) {
    return {
      ok: true,
      source: 'legacy_standalone',
      legacySessionId: legacySessionValue,
    };
  }
  return { ok: false, source: 'none' };
}

export const RESEARCH_ENTITLEMENT_KEYS = {
  purchase: STORAGE_KEYS.purchase,
  legacySession: RESEARCH_EDITION.storageKey,
};
