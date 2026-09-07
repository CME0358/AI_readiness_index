import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EDITORIAL_INTENTS,
  classifyEditorialIntent,
  ctaIntentProfile,
  planWeeklyEditorialMix,
  socialFramingGuidance,
} from '../lib/editorial-intent.mjs';
import { renderInsightCtaHtml } from '../lib/funnel/sitewide-cta.mjs';
import { resolveLeadRoute } from '../lib/funnel/routing.mjs';
import { SEGMENTS } from '../lib/funnel/segments.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('explicit editorialIntent is accepted and old records default safely', () => {
  assert.equal(classifyEditorialIntent({ editorialIntent: 'PROBLEM_AWARE' }), EDITORIAL_INTENTS.PROBLEM_AWARE);
  assert.equal(classifyEditorialIntent({ slug: 'legacy', title: '一般的な研究記事' }), EDITORIAL_INTENTS.RESEARCH);
});

test('intent CTA routing uses the Phase 9B Check anchor', () => {
  assert.equal(ctaIntentProfile('PROBLEM_AWARE')[0].type, 'CHECK');
  assert.equal(ctaIntentProfile('PROBLEM_AWARE')[0].destination, '/#company-check');
  const homepage = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(homepage, /id="company-check"/);
});

test('evidence, product, research, and local intent mappings are bounded', () => {
  assert.deepEqual(ctaIntentProfile('EVIDENCE').map((cta) => cta.type), ['CHECK', 'REPORT']);
  assert.equal(ctaIntentProfile('PRODUCT_AWARE')[0].type, 'REPORT');
  assert.deepEqual(ctaIntentProfile('RESEARCH').map((cta) => cta.type), ['LEARN', 'CHECK']);
  assert.equal(ctaIntentProfile('PROBLEM_AWARE', { local: true })[1].type, 'LOCAL');
  assert.equal(resolveLeadRoute({ segment: SEGMENTS.DIRECT_BUYER, confidence: 0.8 }).action, 'LOCAL');
});

test('selector approaches 3/1/1 when inventory supports it', () => {
  const inventory = [
    ...[1, 2, 3].map((n) => ({ slug: `problem-${n}`, editorialIntent: 'PROBLEM_AWARE', status: 'scheduled' })),
    { slug: 'evidence-1', editorialIntent: 'EVIDENCE', status: 'scheduled' },
    { slug: 'news-1', editorialIntent: 'NEWS', status: 'scheduled' },
  ];
  const result = planWeeklyEditorialMix(inventory);
  assert.equal(result.status, 'EDITORIAL_MIX_TARGET_MET');
  assert.deepEqual(result.counts, { PROBLEM_AWARE: 3, EVIDENCE: 1, NEWS: 1, SOLUTION_AWARE: 0, PRODUCT_AWARE: 0, RESEARCH: 0 });
});

test('selector degrades safely, preserves current-event override, uniqueness, and determinism', () => {
  const inventory = [
    { slug: 'current-news', series: 'current-event', status: 'scheduled' },
    { slug: 'problem-1', editorialIntent: 'PROBLEM_AWARE', status: 'editorial_hold' },
    { slug: 'research-1', status: 'editorial_hold' },
    { slug: 'research-2', status: 'editorial_hold' },
  ];
  const first = planWeeklyEditorialMix(inventory);
  const second = planWeeklyEditorialMix(inventory);
  assert.equal(first.status, 'EDITORIAL_MIX_DEGRADED');
  assert.equal(first.selected[0].slug, 'current-news');
  assert.deepEqual(first, second);
  assert.equal(new Set(first.selected.map((article) => article.slug)).size, first.selected.length);
  assert.ok(first.missing.some(({ intent }) => intent === 'EVIDENCE'));
});

test('article CTA preserves attribution and editorial intent without PII', () => {
  const html = renderInsightCtaHtml('problem-article', 'end', { editorialIntent: 'PROBLEM_AWARE', title: '課題' });
  assert.match(html, /data-source-page="\/insights\/problem-article\//);
  assert.match(html, /data-cta-id="insight_problem-article_check_1"/);
  assert.match(html, /data-cta-type="CHECK"/);
  assert.match(html, /data-editorial-intent="PROBLEM_AWARE"/);
  const tracking = fs.readFileSync(path.join(root, 'assets/sitewide-cta-tracking.js'), 'utf8');
  assert.doesNotMatch(tracking, /email|phone|company_name|raw_url|domain/i);
});

test('channel framing remains distinct and Buffer architecture is untouched', () => {
  assert.notDeepEqual(socialFramingGuidance('PROBLEM_AWARE', 'x'), socialFramingGuidance('PROBLEM_AWARE', 'linkedin'));
  assert.equal(socialFramingGuidance('NEWS', 'facebook').intent, 'NEWS');
  assert.ok(fs.existsSync(path.join(root, 'insights/_social/x/posts')));
  assert.ok(fs.existsSync(path.join(root, 'insights/_social/linkedin/posts')));
  assert.ok(fs.existsSync(path.join(root, 'insights/_social/facebook/posts')));
});
