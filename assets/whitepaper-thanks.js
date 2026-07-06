(function () {
  var product = document.documentElement.dataset.wpProduct;
  if (!product || !window.WHITEPAPER_STRIPE) return;

  var cfg = window.WHITEPAPER_STRIPE[product];
  if (!cfg) return;

  var params = new URLSearchParams(window.location.search);
  var sessionId = params.get("session_id");
  var paid = params.get("paid") === "1" || !!sessionId;
  var canceled = params.get("canceled") === "1";

  if (paid && sessionId) {
    try { sessionStorage.setItem(cfg.storageKey, sessionId); } catch (e) { /* noop */ }
  }

  var hasAccess = paid;
  if (!hasAccess) {
    try { hasAccess = !!sessionStorage.getItem(cfg.storageKey); } catch (e) { /* noop */ }
  }

  if (sessionId || params.get("paid") || canceled) {
    window.history.replaceState({}, "", window.location.pathname);
  }

  var paidBlock = document.getElementById("wp-paid");
  var unpaidBlock = document.getElementById("wp-unpaid");
  var downloadBtn = document.getElementById("wp-download");
  var readLink = document.getElementById("wp-read-online");

  if (hasAccess) {
    if (paidBlock) paidBlock.hidden = false;
    if (unpaidBlock) unpaidBlock.hidden = true;
    if (downloadBtn) {
      downloadBtn.href = cfg.pdfUrl;
      if (cfg.downloadName) downloadBtn.setAttribute("download", cfg.downloadName);
    }
    if (readLink) readLink.href = cfg.readUrl;
  } else {
    if (paidBlock) paidBlock.hidden = true;
    if (unpaidBlock) unpaidBlock.hidden = false;
  }
})();
