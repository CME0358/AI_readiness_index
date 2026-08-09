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
const reportCss = () => fs.readFileSync(path.join(ROOT, 'report/src/report-design.css'), 'utf8');
const reportTokens = () => fs.readFileSync(path.join(ROOT, 'report/src/report-tokens.js'), 'utf8');

const mockForm = { company: 'テスト', url: 'https://example.com', industry: 'IT' };
const mockAI = [{ ai: 'ChatGPT', recognition: 80, recommendation: 70, citation: 60, bookable: true }];
const mockSite = {
  schemaOrg: 'partial', sitemap: 'pass', jsonLd: 'fail', openGraph: 'pass',
  canonical: 'pass', faqSchema: 'fail', hasBooking: true, hasForm: true, isMobile: true,
};
const mockFiles = { hasRobots: true, hasLlms: false };

test('T01 category bars use accent token, not black fill', () => {
  const css = reportCss();
  const src = reportSrc();
  const scoreBarFn = src.match(/function ScoreBar\([^)]*\)\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(css, /report-score-bar__fill--accent[\s\S]*var\(--color-accent\)/);
  assert.match(scoreBarFn, /report-score-bar/);
  assert.doesNotMatch(scoreBarFn, /#0A0A0A/);
  assert.match(src, /variant = SCORE_BAR_VARIANTS\.accent/);
});

test('T02 AI Recognition bars do not use dominant black fill', () => {
  const src = reportSrc();
  const css = reportCss();
  assert.match(src, /SCORE_BAR_VARIANTS\.accentMid/);
  assert.match(src, /SCORE_BAR_VARIANTS\.accentMuted/);
  assert.match(css, /report-score-bar__fill--accent-mid/);
  assert.match(css, /report-score-bar__fill--accent-muted/);
});

test('T03 black remains primary text / CTA', () => {
  const css = reportCss();
  assert.match(css, /report-btn-primary[\s\S]*var\(--color-cta\)/);
  assert.match(css, /\.report-shell[\s\S]*var\(--color-text-primary\)/);
});

test('T04 success green only semantic', () => {
  const css = reportCss();
  assert.match(css, /report-status-tag--positive[\s\S]*var\(--color-success\)/);
  assert.doesNotMatch(reportSrc(), /ScoreBar score=\{item\.coverage\} color=/);
});

test('T05 header has PDF action', () => {
  const src = reportSrc();
  assert.match(src, /report-header-actions/);
  assert.match(src, /PDF保存/);
  assert.match(src, /setPrinting\(true\)/);
});

test('T06 header has improve/support action', () => {
  const src = reportSrc();
  assert.match(src, /改善支援を見る/);
  assert.match(src, /IMPROVE_URL/);
});

test('T07 header support action routes correctly', () => {
  assert.match(reportTokens(), /IMPROVE_URL = "\/improve\.html"/);
  assert.match(reportSrc(), /href=\{IMPROVE_URL\}[\s\S]*改善支援を見る/);
});

test('T08 advisory block includes ¥198,000〜', () => {
  assert.match(reportSrc(), /¥198,000〜（税別）/);
});

test('T09 advisory block includes 12ヶ月契約', () => {
  assert.match(reportSrc(), /12ヶ月契約/);
});

test('T10 footer Advisory primary CTA routes to improve.html', () => {
  const src = reportSrc();
  assert.match(src, /年間改善支援の内容・料金を見る/);
  assert.match(src, /report-advisory-cta[\s\S]*href=\{IMPROVE_URL\}[\s\S]*年間改善支援の内容・料金を見る/);
  assert.doesNotMatch(src, /report-advisory-secondary/);
});

test('T11 report contains no direct mtgschedule URL', () => {
  const src = reportSrc();
  const tokens = reportTokens();
  assert.doesNotMatch(src, /mtgschedule/);
  assert.doesNotMatch(tokens, /mtgschedule/);
});

test('T12 improve.html preserves mtgschedule Advisory CTA', () => {
  const improve = fs.readFileSync(path.join(ROOT, 'improve.html'), 'utf8');
  assert.match(improve, /readiness\/mtgschedule/);
  assert.match(improve, /Agent Readiness Advisoryについて相談する/);
  assert.match(improve, /¥198,000/);
});

test('T13 RMVU-02 integrity preserved', () => {
  const paid = buildReport(mockForm, mockAI, mockSite, mockFiles, { productMode: 'paid' });
  assert.equal(paid.competitors, undefined);
  assert.equal(paid.rank, undefined);
  assert.equal(paid.deviation, undefined);
  const analyzeSrc = fs.readFileSync(path.join(ROOT, 'api/analyze.js'), 'utf8');
  assert.match(analyzeSrc, /live_analysis_unavailable/);
});

test('T14 RMVU-03 fulfillment preserved', () => {
  const src = reportSrc();
  assert.match(src, /openResearchEdition/);
  assert.match(src, /Research Edition 2026をダウンロード/);
  assert.match(src, /verifyPurchaseSession/);
  assert.match(src, /saveReportCache/);
});

test('T15 no certification', () => {
  const src = reportSrc();
  assert.doesNotMatch(src, /Certified/);
  assert.doesNotMatch(src, /認証審査/);
  assert.doesNotMatch(src, /Agent Ready Certification/);
});

test('T16 no ABIS exposure', () => {
  const src = reportSrc();
  for (const slug of PROTECTED_ABIS_SLUGS) {
    assert.doesNotMatch(src, new RegExp(slug));
  }
});

/* RMVU-04A regression anchors */
test('design-system connected', () => {
  const index = fs.readFileSync(path.join(ROOT, 'report/index.html'), 'utf8');
  assert.match(index, /design-system\.css/);
  assert.match(reportCss(), /var\(--container-max\)/);
});

test('Priority TOP3 and sample label preserved', () => {
  const src = reportSrc();
  assert.match(src, /まず取り組むべき3項目/);
  assert.match(src, /SAMPLE \/ DEMO/);
});

test('Upgrade ¥69k preserved', () => {
  assert.match(reportSrc(), /¥69,000/);
  assert.match(reportSrc(), /openHandbookUpgrade/);
  assert.equal(PRODUCTS.handbookUpgrade.priceExTax, 69_000);
});

test('retry without repayment preserved', () => {
  const src = reportSrc();
  assert.match(src, /解析を再試行/);
  assert.match(src, /追加決済は不要/);
});
