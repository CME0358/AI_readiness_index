/**
 * RMVU-03B — Browser Research entitlement (Company Report bundle + legacy standalone).
 */
(function (global) {
  var PURCHASE_KEY = "ari_purchase_state";
  var LEGACY_KEY = "wp_research_paid";
  var PDF_PATH = "/whitepaper/2026/research/assets/ARI_Research_Report_2026.pdf";
  var READ_PATH = "/whitepaper/2026/research/index.html";
  var DOWNLOAD_PAGE = "/whitepaper/2026/research/download.html";
  var THANKS_PATH = "/whitepaper/2026/research/thanks.html";
  var BUNDLE_DOWNLOAD = "/whitepaper/2026/research/download.html";

  function parsePurchase(raw) {
    if (!raw) return null;
    try {
      var state = JSON.parse(raw);
      if (!state || !state.expiresAt || Date.now() > state.expiresAt) return null;
      return state;
    } catch (e) {
      return null;
    }
  }

  function resolveEntitlement(storage) {
    storage = storage || {};
    var local = storage.localStorage;
    var session = storage.sessionStorage;
    var purchase = local ? parsePurchase(local.getItem(PURCHASE_KEY)) : null;
    if (purchase && purchase.entitlements && purchase.entitlements.researchEdition) {
      return { ok: true, source: "company_report_bundle", purchase: purchase };
    }
    var legacy = session ? session.getItem(LEGACY_KEY) : null;
    if (legacy) {
      return { ok: true, source: "legacy_standalone", legacySessionId: legacy };
    }
    return { ok: false, source: "none" };
  }

  global.RESEARCH_ENTITLEMENT = {
    PURCHASE_KEY: PURCHASE_KEY,
    LEGACY_KEY: LEGACY_KEY,
    PDF_PATH: PDF_PATH,
    READ_PATH: READ_PATH,
    DOWNLOAD_PAGE: DOWNLOAD_PAGE,
    BUNDLE_DOWNLOAD: BUNDLE_DOWNLOAD,
    THANKS_PATH: THANKS_PATH,
    parsePurchase: parsePurchase,
    resolveEntitlement: resolveEntitlement,
  };
})(typeof window !== "undefined" ? window : globalThis);
