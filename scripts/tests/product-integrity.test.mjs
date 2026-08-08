#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STRIPE_LINKS,
  PROTECTED_ABIS_SLUGS,
  applyPaidProductIntegrity,
  shouldRejectPaidAnalysis,
  certNumberDeterministic,
  hasRandomCompetitorNames,
  hasPopulationRankFields,
} from '../lib/product-integrity.mjs';
import { buildReport } from '../../api/analyze.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const mockForm = { company: 'テスト株式会社', url: 'https://example.com', industry: 'IT' };
const mockAI = [
  { ai: 'ChatGPT', recognition: 80, recommendation: 70, citation: 60, bookable: true },
  { ai: 'Gemini', recognition: 75, recommendation: 65, citation: 55, bookable: false },
];
const mockSite = {
  schemaOrg: 'partial', sitemap: 'pass', jsonLd: 'fail', openGraph: 'pass',
  canonical: 'pass', faqSchema: 'fail', hasBooking: true, hasForm: true, isMobile: true,
};
const mockFiles = { hasRobots: true, hasLlms: false };

test('T01 paid live analysis never silently uses DEMO (missing keys)', () => {
  const gate = shouldRejectPaidAnalysis({ paid: true, hasAnyKey: false, validAICount: 0 });
  assert.equal(gate.reject, true);
  assert.equal(gate.reason, 'missing_api_keys');
  const analyzeSrc = fs.readFileSync(path.join(ROOT, 'api/analyze.js'), 'utf8');
  assert.match(analyzeSrc, /live_analysis_unavailable/);
  assert.match(analyzeSrc, /paid:\s*true/);
});

test('T02 demo route can use DEMO safely', () => {
  const reportSrc = fs.readFileSync(path.join(ROOT, 'report/src/agent-readiness-report.jsx'), 'utf8');
  assert.match(reportSrc, /report=demo/);
  assert.match(reportSrc, /SAMPLE \/ DEMO/);
  const demo = buildReport(mockForm, [], mockSite, mockFiles, { productMode: 'demo' });
  assert.ok(demo?.overallScore);
  assert.ok(hasPopulationRankFields(demo));
});

test('T03 random competitor scores not shown as real paid analysis', () => {
  const liveDemo = buildReport(mockForm, mockAI, mockSite, mockFiles, { productMode: 'demo' });
  assert.ok(hasRandomCompetitorNames(liveDemo.competitors));
  const paid = buildReport(mockForm, mockAI, mockSite, mockFiles, { productMode: 'paid' });
  assert.equal(paid.competitors, undefined);
  assert.equal(hasRandomCompetitorNames(paid.competitors), false);
});

test('T04 random national rank not shown on paid report', () => {
  const paid = buildReport(mockForm, mockAI, mockSite, mockFiles, { productMode: 'paid' });
  assert.equal(hasPopulationRankFields(paid), false);
});

test('T05 random deviation not shown on paid report', () => {
  const paid = applyPaidProductIntegrity({
    overallScore: 70,
    deviation: 62.3,
    rank: { national: 124, tokyo: 10, industry: 3 },
    certification: 'Gold',
    certificate: { number: 'X' },
  }, mockForm);
  assert.equal(paid.deviation, undefined);
  assert.equal(paid.rank, undefined);
});

test('T06 company score deterministic certificate for same fixture', () => {
  const a = certNumberDeterministic(mockForm, 'Gold');
  const b = certNumberDeterministic(mockForm, 'Gold');
  assert.equal(a, b);
  assert.match(a, /^ARI-\d{4}-G-\d{6}$/);
});

test('T07 roadmap based on report inputs / score', () => {
  const paid = buildReport(mockForm, mockAI, mockSite, mockFiles, { productMode: 'paid' });
  assert.ok(Array.isArray(paid.roadmap));
  assert.ok(paid.roadmap.some((r) => /LLMs\.txt|FAQ Schema/.test(r.action)));
});

test('T08 Research canonical payment link consistency', () => {
  const stripeJs = fs.readFileSync(path.join(ROOT, 'assets/whitepaper-stripe.js'), 'utf8');
  assert.match(stripeJs, new RegExp(STRIPE_LINKS.researchCanonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const researchHtml = fs.readFileSync(path.join(ROOT, 'research/index.html'), 'utf8');
  assert.match(researchHtml, /dRmdRa1ppgP7107ddpcMM0k/);
});

test('T09 legacy links preserved', () => {
  const reportSrc = fs.readFileSync(path.join(ROOT, 'report/src/agent-readiness-report.jsx'), 'utf8');
  assert.match(reportSrc, /9B600kecb8iBdMTb5hcMM0g/);
  const stripeJs = fs.readFileSync(path.join(ROOT, 'assets/whitepaper-stripe.js'), 'utf8');
  assert.match(stripeJs, /5kQ7sM6JJ0Q99wDehtcMM0i/);
});

test('T10 protected ABIS unaffected', () => {
  for (const slug of PROTECTED_ABIS_SLUGS) {
    const p = path.join(ROOT, 'insights', slug, 'index.html');
    if (fs.existsSync(p)) {
      const html = fs.readFileSync(p, 'utf8');
      assert.doesNotMatch(html, /product-integrity|RMVU-02/);
    }
  }
  assert.equal(PROTECTED_ABIS_SLUGS.length, 6);
});

test('paid flow rejects when AI queries all fail', () => {
  const gate = shouldRejectPaidAnalysis({ paid: true, hasAnyKey: true, validAICount: 0 });
  assert.equal(gate.reject, true);
  assert.equal(gate.reason, 'ai_query_failed');
});
