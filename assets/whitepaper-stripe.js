/**
 * Whitepaper Stripe Payment Links
 *
 * Stripe Dashboard で各 Payment Link を作成し、success_url を以下に設定:
 *   Research:  https://readiness.coaretail.com/whitepaper/2026/research/thanks.html?session_id={CHECKOUT_SESSION_ID}
 *   Handbook:  https://readiness.coaretail.com/whitepaper/2026/handbook/thanks.html?session_id={CHECKOUT_SESSION_ID}
 *
 * cancel_url（任意）:
 *   .../research/checkout.html?canceled=1
 *   .../handbook/checkout.html?canceled=1
 */
window.WHITEPAPER_STRIPE = {
  research: {
    paymentLink: "https://buy.stripe.com/dRmdRa1ppgP7107ddpcMM0k",
    pdfUrl: "assets/ARI_Research_Report_2026.pdf",
    downloadName: "Agent Readiness Research Report 2026.pdf",
    readUrl: "./index.html",
    productName: "Agent Readiness Research Report 2026",
    edition: "Research Edition",
    priceLabel: "¥29,800（税別）",
    storageKey: "wp_research_paid",
  },
  handbook: {
    paymentLink: "https://buy.stripe.com/5kQ7sM6JJ0Q99wDehtcMM0i",
    pdfUrl: "assets/ARI_Methodology_Handbook_2026.pdf",
    downloadName: "Agent Readiness Methodology Handbook 2026.pdf",
    readUrl: "./index.html",
    productName: "Agent Readiness Methodology Handbook 2026",
    edition: "Methodology Handbook",
    priceLabel: "¥98,000（税別）",
    storageKey: "wp_handbook_paid",
  },
  handbookUpgrade: {
    paymentLink: "https://buy.stripe.com/00waEY6JJ0Q9bELgpBcMM0j",
    productName: "Agent Readiness Methodology Handbook 2026 (Upgrade)",
    edition: "Methodology Handbook Upgrade",
    priceLabel: "¥69,000（税別）",
    upgradeForExistingCompanyReport: true,
  },
};
