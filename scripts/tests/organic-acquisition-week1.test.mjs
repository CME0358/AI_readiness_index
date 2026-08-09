#!/usr/bin/env node
/**
 * RMVU-05A — Organic Acquisition Week 1 Foundation tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROTECTED_INTERNAL_LINK_SLUGS,
  computeIncomingRelatedCounts,
  loadSchedule,
  selectRelatedInsights,
} from '../lib/insights-related-links.mjs';
import { PROTECTED_ABIS_SLUGS } from '../lib/product-integrity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const blind = () => read('insights/blind/index.html');
const analyticsJs = () => read('assets/analytics.js');

test('RMVU-05A T01 blind contains /report/ CTA', () => {
  assert.match(blind(), /href="\/report\/"/);
});

test('RMVU-05A T02 blind CTA copy reflects improvement priority', () => {
  const html = blind();
  assert.match(html, /自社の改善優先順位を確認する/);
  assert.match(html, /一般的な対策ではなく、自社の場合どこから直すべきか確認する/);
});

test('RMVU-05A T03 blind retains data-ga-insight-cta="report"', () => {
  assert.match(blind(), /data-ga-insight-cta="report"/);
});

test('RMVU-05A T04 insight_cta_report hook preserved', () => {
  assert.match(analyticsJs(), /insight_cta_report/);
  assert.match(blind(), /data-ga-insight-cta="report"/);
});

test('RMVU-05A T05 blind contains Research/Evidence link', () => {
  const html = blind();
  assert.match(html, /href="\/research\/"/);
  assert.match(html, /href="\/evidence\/"/);
  assert.match(html, /100問調査/);
  assert.match(html, /5業種231件/);
});

test('RMVU-05A T06 blind does not expose ABIS', () => {
  const html = blind();
  for (const slug of PROTECTED_ABIS_SLUGS) {
    assert.doesNotMatch(html, new RegExp(slug));
  }
});

test('RMVU-05A T07 citation-vs-action receives valid inbound related links', () => {
  const counts = computeIncomingRelatedCounts({ schedule: loadSchedule() });
  assert.ok((counts['citation-vs-action'] || 0) >= 2, `incoming=${counts['citation-vs-action']}`);
  const fromRec = selectRelatedInsights('recommendation-logic', { mode: 'published' });
  assert.ok(fromRec.some((r) => r.slug === 'citation-vs-action'));
});

test('RMVU-05A T08 reviews receives valid inbound related links', () => {
  const counts = computeIncomingRelatedCounts({ schedule: loadSchedule() });
  assert.ok((counts.reviews || 0) >= 2, `incoming=${counts.reviews}`);
  const fromTrust = selectRelatedInsights('trust', { mode: 'published' });
  assert.ok(fromTrust.some((r) => r.slug === 'reviews'));
});

test('RMVU-05A T09 protected ABIS slugs absent from generated related links', () => {
  for (const slug of getPublishedSample()) {
    const related = selectRelatedInsights(slug, { mode: 'published' });
    for (const r of related) {
      assert.ok(!PROTECTED_INTERNAL_LINK_SLUGS.has(r.slug), `${slug} -> ${r.slug}`);
    }
  }
});

test('RMVU-05A T10 TMVU-03 logic preserved', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts/tmvu-03-validate.mjs')));
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts/apply-tmvu-03-internal-links.mjs')));
});

test('RMVU-05A T11 scheduled articles remain unpublished', () => {
  const schedule = loadSchedule();
  const hold = schedule.articles.filter((a) => a.status === 'editorial_hold');
  assert.ok(hold.length >= 19);
  for (const slug of ['readiness-baseline', 'ari-vs-geo-seo']) {
    const entry = schedule.articles.find((a) => a.slug === slug);
    assert.equal(entry?.status, 'editorial_hold');
  }
});

test('RMVU-05A T12 no Stripe changes in RMVU-05A scope', () => {
  const diffFiles = ['insights/blind/index.html', 'scripts/lib/insights-related-links.mjs'];
  for (const rel of diffFiles) {
    assert.doesNotMatch(read(rel), /buy\.stripe\.com/);
  }
});

test('RMVU-05A T13 Company Report Bundle preserved', () => {
  const fulfillment = read('report/src/fulfillment.js');
  assert.match(fulfillment, /VITE_COMPANY_REPORT_BUNDLE_PAYMENT_URL/);
  assert.match(fulfillment, /allowLegacy:\s*false/);
});

test('RMVU-05A T14 RMVU-04F positioning preserved on blind', () => {
  const html = blind();
  assert.match(html, /Discovery/);
  assert.match(html, /Recommendation/);
  assert.match(html, /Action/);
  assert.doesNotMatch(html, /Technical Readiness Scanner/i);
});

test('RMVU-05A T15 GSC template contains clicks/impressions/CTR/position', () => {
  const doc = read('reports/Organic Search Weekly Baseline.md');
  assert.match(doc, /Total Clicks/);
  assert.match(doc, /Total Impressions/);
  assert.match(doc, /CTR/);
  assert.match(doc, /Average Position/);
});

test('RMVU-05A T16 GSC template contains Cluster A–F', () => {
  const doc = read('reports/Organic Search Weekly Baseline.md');
  for (const c of ['A', 'B', 'C', 'D', 'E', 'F']) {
    assert.match(doc, new RegExp(`\\| ${c} \\|`));
  }
});

test('RMVU-05A T17 GA4 funnel event names unchanged', () => {
  const doc = read('reports/Organic Search Weekly Baseline.md');
  const reportAnalytics = read('report/src/analytics.js');
  for (const ev of [
    'insight_cta_report',
    'report_start',
    'report_form_complete',
    'report_checkout_start',
    'purchase_verified',
  ]) {
    assert.match(doc, new RegExp(ev));
    if (ev === 'insight_cta_report') {
      assert.match(analyticsJs(), new RegExp(ev));
    } else {
      assert.match(reportAnalytics, new RegExp(ev));
    }
  }
});

test('RMVU-05A blind title/meta preserved', () => {
  const html = blind();
  assert.match(html, /AIに会社が出ない原因5つ/);
  assert.match(html, /Visibilityを阻害する要因/);
});

function getPublishedSample() {
  return fs
    .readdirSync(path.join(ROOT, 'insights'))
    .filter((d) => !d.startsWith('_') && fs.existsSync(path.join(ROOT, 'insights', d, 'index.html')))
    .slice(0, 8);
}
