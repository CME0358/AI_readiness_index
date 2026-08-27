#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRODUCTS,
  FULFILLMENT_STATES,
  resolveCompanyReportPaymentLink,
  resolveBundlePaymentLink,
  STRIPE_AMOUNT_TAX_INCL,
} from '../lib/product-catalog.mjs';
import {
  STORAGE_KEYS,
  REPORT_CACHE_TTL_MS,
  createPurchaseState,
  createReportCache,
  isExpired,
  hasActivePurchase,
  canRetryAnalysis,
  resolveProductFromStripeSession,
  resolveCompanyReportProductFromStripeSession,
  buildLegacyPurchaseState,
  grantBrowserEntitlements,
} from '../lib/fulfillment-state.mjs';
import { PROTECTED_ABIS_SLUGS } from '../lib/product-integrity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('T01 paid entitlement requires authoritative verified purchase state', () => {
  const legacy = buildLegacyPurchaseState();
  assert.equal(legacy.verified, false);
  assert.equal(legacy.verificationMethod, 'legacy_query');
  assert.equal(hasActivePurchase(legacy), false);
  const reportSrc = fs.readFileSync(path.join(ROOT, 'report/src/agent-readiness-report.jsx'), 'utf8');
  assert.match(reportSrc, /verifyPurchaseSession/);
  assert.doesNotMatch(reportSrc, /grantLegacyCompanyReportPurchase/);
});

test('T02 paid result survives reload within TTL', () => {
  const cache = createReportCache({
    report: { overallScore: 70, company: 'Test' },
    form: { company: 'Test', url: 'https://t.example', industry: 'IT', email: 'a@b.c' },
  });
  assert.ok(cache.expiresAt > Date.now());
  assert.ok(cache.expiresAt <= Date.now() + REPORT_CACHE_TTL_MS + 1000);
  assert.equal(cache.report.overallScore, 70);
});

test('T03 expired cache does not restore indefinitely', () => {
  const expired = { expiresAt: Date.now() - 1000 };
  assert.equal(isExpired(expired), true);
});

test('T04 payment success + analysis failure can retry', () => {
  const purchase = createPurchaseState({
    productId: PRODUCTS.companyReportLegacy.id,
    fulfillmentState: FULFILLMENT_STATES.PAID_COMPANY_REPORT,
    entitlements: PRODUCTS.companyReportLegacy.entitlements,
    verified: true,
    verificationMethod: 'stripe_api',
  });
  assert.equal(canRetryAnalysis(purchase), true);
  const src = fs.readFileSync(path.join(ROOT, 'report/src/agent-readiness-report.jsx'), 'utf8');
  assert.match(src, /解析を再試行/);
  assert.match(src, /追加決済は不要/);
});

test('T05 retry does not request second payment', () => {
  const src = fs.readFileSync(path.join(ROOT, 'report/src/agent-readiness-report.jsx'), 'utf8');
  assert.doesNotMatch(src, /onRetry[\s\S]*STRIPE_CHECKOUT/);
  assert.match(src, /onRetry\?\.\(\)/);
});

test('T06 silent DEMO remains disabled for paid', () => {
  const analyzeSrc = fs.readFileSync(path.join(ROOT, 'api/analyze.js'), 'utf8');
  assert.match(analyzeSrc, /live_analysis_unavailable/);
  assert.match(analyzeSrc, /paid:\s*true/);
});

test('T07 Research entitlement available for company report purchase', () => {
  const purchase = createPurchaseState({
    entitlements: PRODUCTS.companyReportLegacy.entitlements,
  });
  const granted = grantBrowserEntitlements(purchase.entitlements, 'cs_test', {
    sessionStorage: { _data: {}, setItem(k, v) { this._data[k] = v; }, getItem(k) { return this._data[k]; } },
  });
  assert.ok(granted.includes('researchEdition'));
});

test('T08 Research legacy flow preserved', () => {
  const stripeJs = fs.readFileSync(path.join(ROOT, 'assets/whitepaper-stripe.js'), 'utf8');
  assert.match(stripeJs, /dRmdRa1ppgP7107ddpcMM0k/);
  assert.match(stripeJs, /wp_research_paid/);
});

test('T09 ¥69,000 upgrade link preserved', () => {
  assert.equal(PRODUCTS.handbookUpgrade.priceExTax, 69_000);
  assert.equal(PRODUCTS.handbookUpgrade.priceTaxIncl, 75_900);
  assert.match(PRODUCTS.handbookUpgrade.paymentLink, /00waEY6JJ0Q9bELgpBcMM0j/);
});

test('T10 ¥98,000 Full link preserved', () => {
  assert.equal(PRODUCTS.handbookFull.priceExTax, 98_000);
  assert.match(PRODUCTS.handbookFull.paymentLink, /5kQ7sM6JJ0Q99wDehtcMM0i/);
});

test('T11 Bundle URL missing → legacy with flag, strict mode fails safe', () => {
  const legacy = resolveCompanyReportPaymentLink({ env: {}, allowLegacy: true });
  assert.ok(legacy.url);
  assert.equal(legacy.bundleLinkRequired, true);
  const strict = resolveCompanyReportPaymentLink({ env: {}, allowLegacy: false });
  assert.equal(strict.url, null);
});

test('T12 Protected ABIS untouched', () => {
  assert.equal(PROTECTED_ABIS_SLUGS.length, 6);
  const catalogSrc = fs.readFileSync(path.join(ROOT, 'scripts/lib/product-catalog.mjs'), 'utf8');
  assert.doesNotMatch(catalogSrc, /abis-intro/);
});

test('T13 TMVU gates preserved — product catalog has no insights edits', () => {
  const prepublish = fs.readFileSync(path.join(ROOT, 'scripts/tmvu-05-validate.mjs'), 'utf8');
  assert.match(prepublish, /PROTECTED_ABIS/);
});

test('Stripe session resolves company report by amount + hint', () => {
  const session = { payment_status: 'paid', amount_total: STRIPE_AMOUNT_TAX_INCL.companyReport, id: 'cs_test_1' };
  const product = resolveProductFromStripeSession(session, 'company_report');
  assert.equal(product.id, PRODUCTS.companyReportLegacy.id);
});

test('strict Company Report resolver requires authoritative identity', () => {
  const valid = {
    payment_status: 'paid',
    amount_total: STRIPE_AMOUNT_TAX_INCL.companyReport,
    metadata: { product_sku: 'company_report' },
  };
  assert.equal(resolveCompanyReportProductFromStripeSession(valid)?.id, PRODUCTS.companyReportBundle.id);
  assert.equal(resolveCompanyReportProductFromStripeSession({
    ...valid,
    metadata: { product_sku: 'research_edition' },
  }), null);
  assert.equal(resolveCompanyReportProductFromStripeSession({
    ...valid,
    metadata: {},
    client_reference_id: 'research_edition',
  }), null);
  assert.equal(resolveCompanyReportProductFromStripeSession({
    ...valid,
    metadata: {},
    payment_link: 'plink_company_report',
  }, { expectedPaymentLinkId: 'plink_company_report' })?.id, PRODUCTS.companyReportBundle.id);
});

test('paid analyze path requires a purchase session and server verification', () => {
  const analyzeSrc = fs.readFileSync(path.join(ROOT, 'api/analyze.js'), 'utf8');
  assert.match(analyzeSrc, /purchaseSessionId \|\| body\.sessionId/);
  assert.match(analyzeSrc, /retrieveCheckoutSession\(sessionId, secretKey\)/);
  assert.match(analyzeSrc, /paid_analysis_requires_verified_purchase/);
});

test('verify-purchase endpoint exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'api/verify-purchase.js')));
  const src = fs.readFileSync(path.join(ROOT, 'api/verify-purchase.js'), 'utf8');
  assert.match(src, /STRIPE_SECRET_KEY/);
  assert.doesNotMatch(src, /NEXT_PUBLIC/);
});

test('purchase state storage key defined', () => {
  assert.equal(STORAGE_KEYS.purchase, 'ari_purchase_state');
  assert.equal(STORAGE_KEYS.reportCache, 'ari_report_cache');
});

test('bundle env resolver', () => {
  assert.equal(resolveBundlePaymentLink({ COMPANY_REPORT_BUNDLE_PAYMENT_URL: 'https://buy.stripe.com/test' }),
    'https://buy.stripe.com/test');
  assert.equal(resolveBundlePaymentLink({}), null);
});
