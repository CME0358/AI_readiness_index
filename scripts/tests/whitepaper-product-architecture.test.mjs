#!/usr/bin/env node
/**
 * RMVU-04G — Whitepaper Product Architecture Consolidation tests.
 */
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
import { PROTECTED_ABIS_SLUGS } from '../lib/product-integrity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const whitepaper = () => read('whitepaper/index.html');

test('RMVU-04G T01 Whitepaper primary grid contains 3 products', () => {
  const html = whitepaper();
  assert.match(html, /data-whitepaper-products="3"/);
  assert.match(html, /grid-template-columns: repeat\(3, 1fr\)/);
  const productLinks = (html.match(/<a class="report-card/g) || []).length;
  assert.equal(productLinks, 3);
});

test('RMVU-04G T02 Research Edition is not standalone primary card', () => {
  const html = whitepaper();
  assert.doesNotMatch(html, /data-item-name="Research Edition 2026"/);
  assert.doesNotMatch(html, /<h2>Research Edition 2026<\/h2>/);
  assert.doesNotMatch(html, /class="report-card report-card-soon"/);
});

test('RMVU-04G T03 Company Report explicitly includes Research Edition', () => {
  const html = whitepaper();
  assert.match(html, /Research Edition 2026 included/i);
  assert.match(html, /report-included-evidence/);
  assert.match(html, /Research \/ Benchmark Evidence/);
  assert.match(html, /report-card--primary/);
});

test('RMVU-04G T04 Company Report price ¥29,800 preserved', () => {
  const html = whitepaper();
  assert.match(html, /¥29,800/);
  assert.match(html, /¥32,780/);
  assert.equal(PRODUCTS.companyReportBundle.priceExTax, 29_800);
});

test('RMVU-04G T05 Handbook ¥98,000 preserved', () => {
  const html = whitepaper();
  assert.match(html, /¥98,000/);
  assert.match(html, /5kQ7sM6JJ0Q99wDehtcMM0i/);
  assert.equal(PRODUCTS.handbookFull.priceExTax, 98_000);
});

test('RMVU-04G T06 Free Report preserved', () => {
  const html = whitepaper();
  assert.match(html, /Agent Readiness Report 2026/);
  assert.match(html, /FREE/);
  assert.match(html, /\.\/2026\/free\//);
  assert.match(html, /無料レポートを入手する/);
});

test('RMVU-04G T07 No Research standalone purchase CTA in primary funnel', () => {
  const html = whitepaper();
  assert.doesNotMatch(html, /buy\.stripe\.com\/dRmdRa1ppgP7107ddpcMM0k/);
  assert.doesNotMatch(html, /Research Edition.*(を購入|購入する)/i);
  assert.doesNotMatch(html, /2026\/research\/checkout\.html/);
  assert.match(html, /自社の改善優先順位を確認する/);
});

test('RMVU-04G T08 Legacy Research link preserved for compatibility', () => {
  const stripeJs = read('assets/whitepaper-stripe.js');
  assert.match(stripeJs, /dRmdRa1ppgP7107ddpcMM0k/);
  assert.ok(fs.existsSync(path.join(ROOT, 'whitepaper/2026/research/checkout.html')));
  assert.match(read('whitepaper/2026/research/checkout.html'), /Legacy standalone/);
});

test('RMVU-04G T09 Research entitlement preserved', () => {
  assert.equal(RESEARCH_EDITION.bundleDownloadPath, '/whitepaper/2026/research/download.html');
  const fulfillment = read('report/src/fulfillment.js');
  assert.match(fulfillment, /researchEdition/);
  assert.match(fulfillment, /bundleDownloadPath/);
});

test('RMVU-04G T10 Company Report Bundle preserved', () => {
  const fulfillment = read('report/src/fulfillment.js');
  assert.match(fulfillment, /VITE_COMPANY_REPORT_BUNDLE_PAYMENT_URL/);
  assert.match(fulfillment, /allowLegacy:\s*false/);
  const checkout = resolveCompanyReportPaymentLink({ allowLegacy: true });
  assert.ok(checkout.url);
});

test('RMVU-04G T11 Stripe unchanged on whitepaper primary funnel', () => {
  const html = whitepaper();
  assert.doesNotMatch(html, /9B600kecb8iBdMTb5hcMM0g/);
  assert.doesNotMatch(html, /dRmdRa1ppgP7107ddpcMM0k/);
  assert.match(html, /5kQ7sM6JJ0Q99wDehtcMM0i/);
});

test('RMVU-04G T12 ABIS protected', () => {
  const html = whitepaper();
  for (const slug of PROTECTED_ABIS_SLUGS) {
    assert.doesNotMatch(html, new RegExp(slug));
  }
});

test('RMVU-04G T13 GA4 hooks preserved', () => {
  const html = whitepaper();
  assert.match(html, /ga4\.js/);
  assert.match(html, /whitepaper-download-tracking\.js/);
  assert.match(html, /data-item-name=/);
});

test('RMVU-04G T14 Advisory unaffected', () => {
  const improve = read('improve.html');
  assert.match(improve, /Agent Readiness Advisory/);
  assert.match(improve, /¥198,000/);
  assert.doesNotMatch(whitepaper(), /improve\.html/);
});

test('RMVU-04G Handbook upgrade ¥69,000 referenced where needed', () => {
  const html = whitepaper();
  assert.match(html, /¥69,000/);
  assert.equal(PRODUCTS.handbookUpgrade.priceExTax, 69_000);
});

test('RMVU-04G product ladder What vs How clarified', () => {
  const html = whitepaper();
  assert.match(html, /What \/ Priority/);
  assert.match(html, /How \/ Implementation Method/);
});
