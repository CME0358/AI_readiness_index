#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTECTED_ABIS_SLUGS } from '../lib/product-integrity.mjs';
import { buildReport } from '../../api/analyze.js';
import { PRODUCTS } from '../lib/product-catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const reportSrc = () => fs.readFileSync(path.join(ROOT, 'report/src/agent-readiness-report.jsx'), 'utf8');
const reportIndex = () => fs.readFileSync(path.join(ROOT, 'report/index.html'), 'utf8');
const reportMain = () => fs.readFileSync(path.join(ROOT, 'report/src/main.jsx'), 'utf8');
const reportCss = () => fs.readFileSync(path.join(ROOT, 'report/src/report-design.css'), 'utf8');

const mockForm = { company: 'テスト', url: 'https://example.com', industry: 'IT' };
const mockAI = [{ ai: 'ChatGPT', recognition: 80, recommendation: 70, citation: 60, bookable: true }];
const mockSite = {
  schemaOrg: 'partial', sitemap: 'pass', jsonLd: 'fail', openGraph: 'pass',
  canonical: 'pass', faqSchema: 'fail', hasBooking: true, hasForm: true, isMobile: true,
};
const mockFiles = { hasRobots: true, hasLlms: false };

test('T01 design-system connected', () => {
  assert.match(reportIndex(), /design-system\.css/);
  assert.match(reportMain(), /report-design\.css/);
  assert.match(reportCss(), /var\(--container-max\)/);
  assert.match(reportSrc(), /report-shell/);
});

test('T02 paid integrity preserved', () => {
  const paid = buildReport(mockForm, mockAI, mockSite, mockFiles, { productMode: 'paid' });
  assert.equal(paid.competitors, undefined);
  assert.equal(paid.rank, undefined);
  assert.equal(paid.deviation, undefined);
});

test('T03 no competitors/rank/deviation on paid UI path', () => {
  const src = reportSrc();
  assert.match(src, /showRankMetrics/);
  assert.match(src, /showCompetitors/);
  assert.doesNotMatch(src, /全国順位[\s\S]*!showRankMetrics/);
});

test('T04 AI Recognition exists', () => {
  const src = reportSrc();
  assert.match(src, /id="ai"/);
  assert.match(src, /AIから現在どう認識されているか/);
  assert.match(src, /aiRecognition\.map/);
});

test('T05 Priority TOP3 exists', () => {
  const src = reportSrc();
  assert.match(src, /id="priority"/);
  assert.match(src, /まず取り組むべき3項目/);
  assert.match(src, /mapProposalToPriority/);
  assert.match(src, /priorityTop3/);
});

test('T06 Roadmap exists', () => {
  const src = reportSrc();
  assert.match(src, /id="roadmap"/);
  assert.match(src, /RoadmapTimeline/);
});

test('T07 PDF action preserved', () => {
  const src = reportSrc();
  assert.match(src, /setPrinting\(true\)/);
  assert.match(src, /PDFとして保存/);
});

test('T08 Research entitlement preserved', () => {
  const src = reportSrc();
  assert.match(src, /openResearchEdition/);
  assert.match(src, /Research Edition 2026をダウンロード/);
});

test('T09 Upgrade ¥69k preserved', () => {
  const src = reportSrc();
  assert.match(src, /¥69,000/);
  assert.match(src, /openHandbookUpgrade/);
  assert.equal(PRODUCTS.handbookUpgrade.priceExTax, 69_000);
});

test('T10 Advisory CTA preserved', () => {
  const src = reportSrc();
  const tokens = fs.readFileSync(path.join(ROOT, 'report/src/report-tokens.js'), 'utf8');
  assert.match(src, /Agent Readiness Advisoryについて相談する/);
  assert.match(tokens, /readiness\/mtgschedule/);
  assert.match(src, /MTG_SCHEDULE_URL/);
  assert.match(src, /¥198,000/);
  assert.match(src, /12ヶ月契約/);
});

test('T11 sample clearly labeled', () => {
  const src = reportSrc();
  assert.match(src, /SAMPLE \/ DEMO/);
  assert.match(src, /ILLUSTRATIVE DATA/);
});

test('T12 retry without repayment preserved', () => {
  const src = reportSrc();
  assert.match(src, /解析を再試行/);
  assert.match(src, /追加決済は不要/);
});

test('T13 no certification customer copy', () => {
  const src = reportSrc();
  assert.doesNotMatch(src, /Certified/);
  assert.doesNotMatch(src, /認証審査/);
  assert.doesNotMatch(src, /Agent Ready Certification/);
});

test('T14 no ABIS exposure', () => {
  const src = reportSrc();
  for (const slug of PROTECTED_ABIS_SLUGS) {
    assert.doesNotMatch(src, new RegExp(slug));
  }
});

test('T15 TMVU/RMVU regression preserved', () => {
  const src = reportSrc();
  assert.match(src, /verifyPurchaseSession/);
  assert.match(src, /saveReportCache/);
  assert.match(src, /improve\.html/);
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts/tmvu-05-validate.mjs')));
});
