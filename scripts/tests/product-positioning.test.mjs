#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTECTED_ABIS_SLUGS } from '../lib/product-integrity.mjs';
import { buildReport } from '../../api/analyze.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const reportSrc = () => fs.readFileSync(path.join(ROOT, 'report/src/agent-readiness-report.jsx'), 'utf8');
const improveSrc = () => fs.readFileSync(path.join(ROOT, 'improve.html'), 'utf8');

const mockForm = { company: 'テスト', url: 'https://example.com', industry: 'IT' };
const mockAI = [{ ai: 'ChatGPT', recognition: 80, recommendation: 70, citation: 60, bookable: true }];
const mockSite = {
  schemaOrg: 'partial', sitemap: 'pass', jsonLd: 'fail', openGraph: 'pass',
  canonical: 'pass', faqSchema: 'fail', hasBooking: true, hasForm: true, isMobile: true,
};
const mockFiles = { hasRobots: true, hasLlms: false };

test('T01 Paid Report UI has no Certified customer-visible string', () => {
  const src = reportSrc();
  assert.doesNotMatch(src, /Certified/);
  assert.doesNotMatch(src, /認証審査/);
});

test('T02 Certification CTA removed from report nav and footer', () => {
  const src = reportSrc();
  assert.doesNotMatch(src, /Agent Ready Certification/);
  assert.match(src, /improve\.html/);
  assert.match(src, /Advisory|年間改善支援/);
});

test('T03 Readiness Level display preserved', () => {
  const src = reportSrc();
  assert.match(src, /Readiness Level/);
  assert.match(src, /report\.level/);
  const paid = buildReport(mockForm, mockAI, mockSite, mockFiles, { productMode: 'paid' });
  assert.ok(paid.level);
});

test('T04 Research entitlement preserved', () => {
  const src = reportSrc();
  assert.match(src, /openResearchEdition/);
  assert.match(src, /調査データ|Research Edition|Benchmark/);
});

test('T05 Legacy Research standalone link preserved', () => {
  const stripeJs = fs.readFileSync(path.join(ROOT, 'assets/whitepaper-stripe.js'), 'utf8');
  assert.match(stripeJs, /dRmdRa1ppgP7107ddpcMM0k/);
  const researchHtml = fs.readFileSync(path.join(ROOT, 'research/index.html'), 'utf8');
  assert.match(researchHtml, /dRmdRa1ppgP7107ddpcMM0k/);
});

test('T06 Advisory CTA on improve.html', () => {
  const src = improveSrc();
  assert.match(src, /Agent Readiness Advisory/);
  assert.match(src, /coaretail\.com\/readiness\/mtgschedule/);
  assert.doesNotMatch(src, /Agent Ready Certification/);
});

test('T07 No ABIS exposure in changed public files', () => {
  for (const slug of PROTECTED_ABIS_SLUGS) {
    assert.doesNotMatch(reportSrc(), new RegExp(slug));
    assert.doesNotMatch(improveSrc(), new RegExp(slug));
  }
});

test('T08 RMVU-02 integrity preserved', () => {
  const analyzeSrc = fs.readFileSync(path.join(ROOT, 'api/analyze.js'), 'utf8');
  assert.match(analyzeSrc, /live_analysis_unavailable/);
  const paid = buildReport(mockForm, mockAI, mockSite, mockFiles, { productMode: 'paid' });
  assert.equal(paid.competitors, undefined);
});

test('T09 RMVU-03 fulfillment preserved', () => {
  assert.match(reportSrc(), /saveReportCache/);
  assert.match(reportSrc(), /verifyPurchaseSession/);
  assert.ok(fs.existsSync(path.join(ROOT, 'report/src/fulfillment.js')));
});

test('T10 TMVU gates preserved', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts/tmvu-05-validate.mjs')));
  const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
  assert.match(pkg, /validate:insights:prepublish/);
});

test('Research hub positions Company Report as primary product', () => {
  const researchHtml = fs.readFileSync(path.join(ROOT, 'research/index.html'), 'utf8');
  const whitepaperHtml = fs.readFileSync(path.join(ROOT, 'whitepaper/index.html'), 'utf8');
  assert.match(researchHtml, /Agent Readiness Company Report/);
  assert.match(researchHtml, /Research Edition 2026 Included|同梱/);
  assert.match(whitepaperHtml, /Agent Readiness Company Report/);
  assert.match(researchHtml, /Legacy standalone/);
});

test('improve.html does not publish fixed Advisory monthly price', () => {
  const src = improveSrc();
  assert.doesNotMatch(src, /¥60,000/);
  assert.doesNotMatch(src, /600,000/);
});
