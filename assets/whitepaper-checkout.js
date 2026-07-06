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

  if (cfg.paymentLink) {
    btn.addEventListener("click", function () {
      window.location.href = cfg.paymentLink;
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
