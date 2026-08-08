/**
 * Browser product catalog mirror — keep in sync with scripts/lib/product-catalog.mjs
 * RMVU-03 single source for client-side Stripe links & entitlements.
 */
window.PRODUCT_CATALOG = {
  companyReportLegacy: {
    id: "company_report_legacy",
    paymentLink: "https://buy.stripe.com/9B600kecb8iBdMTb5hcMM0g",
    priceTaxIncl: 32780,
    entitlements: { companyReport: true, researchEdition: true, methodologyHandbook: false },
  },
  companyReportBundle: {
    id: "company_report_bundle",
    paymentLink: null,
    requiresNewPaymentLink: true,
    entitlements: { companyReport: true, researchEdition: true, methodologyHandbook: false },
  },
  handbookUpgrade: {
    id: "handbook_upgrade",
    paymentLink: "https://buy.stripe.com/00waEY6JJ0Q9bELgpBcMM0j",
    priceExTax: 69000,
    priceTaxIncl: 75900,
    label: "Methodology Handbook（既購入者向けアップグレード ¥69,000）",
    entitlements: { companyReport: true, researchEdition: true, methodologyHandbook: true },
  },
  handbookFull: {
    id: "handbook_full",
    paymentLink: "https://buy.stripe.com/5kQ7sM6JJ0Q99wDehtcMM0i",
    priceExTax: 98000,
    priceTaxIncl: 107800,
    entitlements: { companyReport: false, researchEdition: true, methodologyHandbook: true },
  },
  researchEdition: {
    id: "research_edition",
    paymentLink: "https://buy.stripe.com/dRmdRa1ppgP7107ddpcMM0k",
    entitlements: { companyReport: false, researchEdition: true, methodologyHandbook: false },
  },
  research: {
    thanksPath: "/whitepaper/2026/research/thanks.html",
    readPath: "/whitepaper/2026/research/index.html",
    pdfPath: "/whitepaper/2026/research/assets/ARI_Research_Report_2026.pdf",
    storageKey: "wp_research_paid",
  },
};
