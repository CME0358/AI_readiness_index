#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRODUCTS,
  RESEARCH_EDITION,
  resolveCompanyReportPaymentLink,
} from '../lib/product-catalog.mjs';
import {
  createPurchaseState,
  grantBrowserEntitlements,
} from '../lib/fulfillment-state.mjs';
import {
  resolveResearchEntitlement,
  hasBundleResearchEntitlement,
} from '../lib/research-entitlement.mjs';
import { PROTECTED_ABIS_SLUGS } from '../lib/product-integrity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const reportSrc = () => fs.readFileSync(path.join(ROOT, 'report/src/agent-readiness-report.jsx'), 'utf8');
const fulfillmentSrc = () => fs.readFileSync(path.join(ROOT, 'report/src/fulfillment.js'), 'utf8');

test('T01 Company Report purchase includes Research entitlement', () => {
  assert.equal(PRODUCTS.companyReportLegacy.entitlements.researchEdition, true);
  assert.equal(PRODUCTS.companyReportBundle.entitlements.researchEdition, true);
  const purchase = createPurchaseState({
    entitlements: PRODUCTS.companyReportLegacy.entitlements,
  });
  assert.ok(hasBundleResearchEntitlement(JSON.stringify(purchase)));
});

test('T02 Company Report Research CTA does NOT open legacy checkout or thanks', () => {
  const src = fulfillmentSrc();
  assert.match(src, /pdfPath/);
  assert.doesNotMatch(src, /thanksPath/);
  assert.doesNotMatch(src, /checkout\.html/);
});

test('T03 Company Report Research CTA does NOT require second payment', () => {
  const src = fulfillmentSrc();
  const fn = src.match(/export function openResearchEdition[\s\S]*?(?=export function|$)/)?.[0] || '';
  assert.doesNotMatch(fn, /buy\.stripe/);
  assert.doesNotMatch(fn, /thanksPath/);
  assert.doesNotMatch(fn, /bundleDownloadPath/);
  assert.match(fn, /pdfPath/);
});

test('T03b Research modal links directly to bundled PDF asset', () => {
  const src = reportSrc();
  assert.match(src, /href=\{RESEARCH_EDITION\.pdfPath\}/);
  assert.match(src, /download=\{RESEARCH_EDITION\.pdfDownloadName\}/);
});

test('T04 bundle download page does NOT show legacy unpaid payment failure copy', () => {
  const html = fs.readFileSync(path.join(ROOT, 'whitepaper/2026/research/download.html'), 'utf8');
  assert.doesNotMatch(html, /決済の確認ができませんでした/);
  assert.match(html, /Company Report に含まれています/);
});

test('T05 Legacy Research standalone Stripe flow preserved', () => {
  const stripeJs = fs.readFileSync(path.join(ROOT, 'assets/whitepaper-stripe.js'), 'utf8');
  assert.match(stripeJs, /dRmdRa1ppgP7107ddpcMM0k/);
  assert.ok(fs.existsSync(path.join(ROOT, 'whitepaper/2026/research/checkout.html')));
  assert.ok(fs.existsSync(path.join(ROOT, 'whitepaper/2026/research/thanks.html')));
});

test('T06 Legacy Research existing buyer flow preserved', () => {
  const thanksJs = fs.readFileSync(path.join(ROOT, 'assets/whitepaper-thanks.js'), 'utf8');
  assert.match(thanksJs, /cfg\.storageKey/);
  assert.match(thanksJs, /sessionStorage\.getItem\(cfg\.storageKey\)/);
  const granted = grantBrowserEntitlements(
    { researchEdition: true },
    'cs_legacy_test',
    { sessionStorage: { _data: {}, setItem(k, v) { this._data[k] = v; }, getItem(k) { return this._data[k]; } } },
  );
  assert.ok(granted.includes('researchEdition'));
});

test('T07 New public funnel does not show two competing ¥29,800 Stripe CTAs', () => {
  for (const rel of ['research/index.html', 'whitepaper/index.html']) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const stripeResearchLinks = (html.match(/buy\.stripe\.com\/dRmdRa1ppgP7107ddpcMM0k/g) || []).length;
    assert.equal(stripeResearchLinks, 0, `${rel} must not expose legacy Research Stripe in new funnel`);
  }
});

test('T08 Company Report remains primary ¥29,800 offer', () => {
  const researchHtml = fs.readFileSync(path.join(ROOT, 'research/index.html'), 'utf8');
  assert.match(researchHtml, /Agent Readiness Company Report/);
  assert.match(researchHtml, /¥29,800/);
  const checkout = resolveCompanyReportPaymentLink({ allowLegacy: true });
  assert.ok(checkout.url);
});

test('T09 Upgrade ¥69,000 preserved', () => {
  assert.match(PRODUCTS.handbookUpgrade.paymentLink, /00waEY6JJ0Q9bELgpBcMM0j/);
  assert.equal(PRODUCTS.handbookUpgrade.priceExTax, 69_000);
});

test('T10 Full ¥98,000 preserved', () => {
  assert.match(PRODUCTS.handbookFull.paymentLink, /5kQ7sM6JJ0Q99wDehtcMM0i/);
  assert.equal(PRODUCTS.handbookFull.priceExTax, 98_000);
});

test('T11 RMVU-02 integrity preserved', () => {
  const analyzeSrc = fs.readFileSync(path.join(ROOT, 'api/analyze.js'), 'utf8');
  assert.match(analyzeSrc, /live_analysis_unavailable/);
});

test('T12 RMVU-03 fulfillment preserved', () => {
  assert.match(fulfillmentSrc(), /verifyPurchaseSession/);
  assert.match(fulfillmentSrc(), /saveReportCache/);
});

test('T13 RMVU-03A Advisory positioning preserved', () => {
  const improve = fs.readFileSync(path.join(ROOT, 'improve.html'), 'utf8');
  assert.match(improve, /Agent Readiness Advisory/);
  assert.doesNotMatch(reportSrc(), /Agent Ready Certification/);
});

test('T14 Protected ABIS untouched', () => {
  for (const slug of PROTECTED_ABIS_SLUGS) {
    assert.doesNotMatch(reportSrc(), new RegExp(slug));
    assert.doesNotMatch(fulfillmentSrc(), new RegExp(slug));
  }
});

test('T15 TMVU gates preserved', () => {
  const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
  assert.match(pkg, /validate:insights:prepublish/);
});

test('resolveResearchEntitlement prefers Company Report localStorage', () => {
  const purchase = createPurchaseState({
    entitlements: { companyReport: true, researchEdition: true, methodologyHandbook: false },
  });
  const result = resolveResearchEntitlement({
    purchaseStateRaw: JSON.stringify(purchase),
    legacySessionValue: null,
  });
  assert.equal(result.ok, true);
  assert.equal(result.source, 'company_report_bundle');
});

test('RESEARCH_EDITION bundleDownloadPath is canonical for Company Report flow', () => {
  assert.equal(RESEARCH_EDITION.bundleDownloadPath, '/whitepaper/2026/research/download.html');
  assert.match(reportSrc(), /Research Edition 2026をダウンロード/);
});
