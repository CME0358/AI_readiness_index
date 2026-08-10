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
  assert.match(src, /ARI Research Report 2026をダウンロード/);
});

test('T05 Legacy Research standalone link preserved', () => {
  const stripeJs = fs.readFileSync(path.join(ROOT, 'assets/whitepaper-stripe.js'), 'utf8');
  assert.match(stripeJs, /dRmdRa1ppgP7107ddpcMM0k/);
  const checkoutHtml = fs.readFileSync(path.join(ROOT, 'whitepaper/2026/research/checkout.html'), 'utf8');
  assert.match(checkoutHtml, /whitepaper-stripe\.js/);
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
  assert.match(researchHtml, /Included with Agent Readiness Company Report/);
  assert.match(whitepaperHtml, /Agent Readiness Company Report/);
  assert.doesNotMatch(researchHtml, /buy\.stripe\.com\/dRmdRa1ppgP7107ddpcMM0k/);
});

test('improve.html publishes canonical Advisory pricing', () => {
  const src = improveSrc();
  assert.doesNotMatch(src, /TBD/);
  assert.doesNotMatch(src, /Consultation/);
  assert.doesNotMatch(src, /¥60,000/);
  assert.match(src, /¥198,000/);
  assert.match(src, /12ヶ月契約/);
  assert.match(src, /250,000/);
  assert.match(src, /300,000/);
  assert.match(src, /readiness\/mtgschedule/);
  assert.doesNotMatch(src, /Agent Ready Certification/);
  assert.doesNotMatch(src, /認証審査/);
  assert.doesNotMatch(src, /Certified/);
});

test('T01 improve.html has 3 pricing cards', () => {
  const src = improveSrc();
  assert.match(src, /data-pricing-cards="3"/);
  assert.match(src, /data-plan="advisory"/);
  assert.match(src, /data-plan="implementation-design"/);
  assert.match(src, /data-plan="managed-implementation"/);
  assert.match(src, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
});

test('T02–T05 improve.html canonical tier prices', () => {
  const src = improveSrc();
  assert.match(src, /月額 ¥198,000〜（税別）/);
  assert.match(src, /12ヶ月契約/);
  assert.match(src, /月額 ¥250,000〜¥300,000程度（税別）/);
  assert.match(src, /月額 ¥300,000〜（税別）/);
});

test('T06 Advisory card is visually primary', () => {
  const src = improveSrc();
  assert.match(src, /pricing-card--primary/);
  assert.match(src, /plan-badge--recommended/);
  assert.match(src, /plan-cta--primary/);
  assert.match(src, /design-system\.css/);
  assert.match(src, /\.pricing-card--primary \{[\s\S]*?background: var\(--color-surface\)/);
  assert.match(src, /\.pricing-card--primary:hover[\s\S]*?background: var\(--color-accent-soft\)/);
});

test('T06b improve.html primary card default and hover visual states', () => {
  const src = improveSrc();
  assert.match(src, /\.plan-badge--recommended \{[\s\S]*?background: rgba\(27, 86, 176, 0\.12\)/);
  assert.match(src, /\.pricing-card--primary:hover \{[\s\S]*?background: var\(--color-accent-soft\)/);
  assert.match(src, /\.pricing-card:hover \{[\s\S]*?background: rgba\(27, 86, 176, 0\.025\)/);
});

test('T07 improve.html conversion copy uses comparison card structure', () => {
  const src = improveSrc();
  assert.match(src, /pricing-comparison-hint/);
  assert.match(src, /含まれる内容/);
  assert.match(src, /こんな企業におすすめ/);
  assert.match(src, /plan-meta-row/);
  assert.match(src, /plan-role-main/);
  assert.match(src, /plan-role-sub/);
  assert.match(src, /伴走・改善判断/);
  assert.match(src, /設計・仕様化/);
  assert.match(src, /実装・運用支援/);
  assert.match(src, /Decide \/ Review/);
  assert.match(src, /Design \/ Specify/);
  assert.match(src, /Execute \/ Operate/);
  assert.equal((src.match(/<div class="plan-contract">12ヶ月契約<\/div>/g) || []).length, 3);
  assert.equal((src.match(/<span class="plan-meta-value">12ヶ月契約<\/span>/g) || []).length, 3);
  assert.match(src, /社内で実装はできるが、何から進めるべきか整理したい/);
  assert.match(src, /やるべき方向性は見えているが、具体的な設計に落とせていない/);
  assert.match(src, /社内リソースだけでは改善実行が進みにくい/);
  assert.doesNotMatch(src, /plan-fit/);
  assert.doesNotMatch(src, /scope-based/);
});

test('T07b improve.html pricing cards have desktop hover feedback', () => {
  const src = improveSrc();
  assert.match(src, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(src, /\.pricing-card:hover/);
  assert.match(src, /translateY\(-2px\)/);
  assert.match(src, /0 6px 20px rgba\(0, 0, 0, 0\.04\)/);
});

test('T08 improve.html CTA destinations unchanged', () => {
  const src = improveSrc();
  const matches = src.match(/https:\/\/www\.coaretail\.com\/readiness\/mtgschedule/g) || [];
  assert.ok(matches.length >= 5, 'hero, 3 card CTAs, and shared CTA should link to mtgschedule');
  assert.match(src, /hero-cta/);
  assert.match(src, /cta-btn/);
  assert.match(src, /plan-cta/);
  assert.match(src, /Agent Readiness Advisoryについて相談する/);
  assert.match(src, /このプランについて相談する/);
  assert.match(src, /設計支援について相談する/);
  assert.match(src, /実装支援について相談する/);
});

test('T09–T10 improve.html has no certification or ABIS exposure', () => {
  const src = improveSrc();
  assert.doesNotMatch(src, /Agent Ready Certification/);
  assert.doesNotMatch(src, /認証審査/);
  assert.doesNotMatch(src, /Certified/);
  for (const slug of PROTECTED_ABIS_SLUGS) {
    assert.doesNotMatch(src, new RegExp(slug));
  }
});

test('T11–T13 RMVU and TMVU preserved after improve.html refinement', () => {
  assert.match(reportSrc(), /improve\.html/);
  assert.match(reportSrc(), /openResearchEdition/);
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts/tmvu-05-validate.mjs')));
  const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
  assert.match(pkg, /validate:insights:prepublish/);
});
