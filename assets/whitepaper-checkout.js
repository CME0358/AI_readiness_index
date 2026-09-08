(function () {
  var product = document.documentElement.dataset.wpProduct;
  if (!product || !window.WHITEPAPER_STRIPE) return;

  var cfg = window.WHITEPAPER_STRIPE[product];
  if (!cfg) return;

  var params = new URLSearchParams(window.location.search);
  if (params.get("canceled") === "1") {
    var notice = document.getElementById("wp-canceled");
    if (notice) notice.hidden = false;
    window.history.replaceState({}, "", window.location.pathname);
  }

  var btn = document.getElementById("wp-checkout-btn");
  var hint = document.getElementById("wp-checkout-hint");
  if (!btn) return;

  var idleLabel = btn.textContent;
  var redirecting = false;

  function trackCheckoutStart() {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", "whitepaper_checkout_start", {
      product: product,
      page: window.location.pathname,
      measurement_schema: "p0-03",
    });
  }

  if (cfg.paymentLink) {
    btn.addEventListener("click", function () {
      if (redirecting || btn.disabled) return;
      redirecting = true;
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      btn.textContent = "Stripeに接続中…";
      if (hint) {
        hint.textContent = "決済ページへ移動します。ブラウザを閉じずにお待ちください。";
        hint.hidden = false;
      }
      trackCheckoutStart();
      window.setTimeout(function () {
        window.location.href = cfg.paymentLink;
      }, 120);
    });
  } else {
    btn.disabled = true;
    btn.textContent = "決済リンク準備中";
    if (hint) {
      hint.textContent = "Stripe Payment Link を assets/whitepaper-stripe.js に設定してください。";
      hint.hidden = false;
    }
  }
})();
