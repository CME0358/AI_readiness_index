import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CTA_TYPES } from '../lib/funnel/cta.mjs';
import { getInsightCtaProfile, renderInsightCtaHtml } from '../lib/funnel/sitewide-cta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('Homepage exposes Learn primary Whitepaper CTA and preserves Report CTA', () => {
  const html = read('index.html');
  assert.match(html, /data-cta-id="homepage_primary_whitepaper" data-cta-type="LEARN"/);
  assert.match(html, /href="report\/"[^>]*data-cta-type="REPORT"/);
});

test('Research and Framework connect to the Free Whitepaper', () => {
  assert.match(read('research/index.html'), /data-cta-id="research_primary_whitepaper" data-cta-type="LEARN"/);
  assert.match(read('framework/index.html'), /data-cta-id="framework_primary_whitepaper" data-cta-type="LEARN"/);
});

test('Evidence uses an end-only Learn CTA and Methodology uses Partner then Report', () => {
  assert.match(read('evidence/index.html'), /data-cta-id="evidence_end_whitepaper" data-cta-type="LEARN"/);
  const methodology = read('methodology.html');
  assert.match(methodology, /data-cta-id="methodology_primary_partner" data-cta-type="PARTNER"/);
  assert.match(methodology, /data-cta-id="methodology_report" data-cta-type="REPORT"/);
});

test('representative Insight intent categories map to the intended primary CTA', () => {
  assert.equal(getInsightCtaProfile('why-ari')[0].type, CTA_TYPES.LEARN);
  assert.equal(getInsightCtaProfile('ai-search-shift')[0].type, CTA_TYPES.LEARN);
  assert.equal(getInsightCtaProfile('org-schema-basics')[0].type, CTA_TYPES.LEARN);
  assert.equal(getInsightCtaProfile('act')[0].type, CTA_TYPES.REPORT);
  assert.equal(getInsightCtaProfile('exec')[0].type, CTA_TYPES.PARTNER);
});

test('unmapped Insight defaults safely to Free Whitepaper then Report', () => {
  const profile = getInsightCtaProfile('not-yet-mapped');
  assert.equal(profile[0].type, CTA_TYPES.LEARN);
  assert.equal(profile[0].destination, '/whitepaper/2026/free/');
  assert.equal(profile[1].type, CTA_TYPES.REPORT);
  assert.match(renderInsightCtaHtml('not-yet-mapped'), /data-cta-type="LEARN"/);
});

test('all 37 published Insights have mapped CTA metadata and tracking', () => {
  const dirs = fs.readdirSync(path.join(ROOT, 'insights'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name)
    .filter((slug) => fs.existsSync(path.join(ROOT, 'insights', slug, 'index.html')));
  assert.equal(dirs.length, 37);
  for (const slug of dirs) {
    const html = read(`insights/${slug}/index.html`);
    assert.match(html, new RegExp(`data-cta-profile="${slug}"`), slug);
    assert.match(html, /data-funnel-cta/);
    assert.match(html, /sitewide-cta-tracking\.js/);
    assert.match(html, /sitewide-cta\.css/);
  }
});

test('Insight generator imports the shared mapping and emits future CTA metadata', () => {
  const source = read('scripts/generate-insight-article.mjs');
  assert.match(source, /lib\/funnel\/sitewide-cta\.mjs/);
  assert.match(source, /renderInsightCtaHtml\(slug\)/);
  const html = renderInsightCtaHtml('future-insight');
  assert.match(html, /data-cta-id="insight_future-insight_learn_1"/);
});

test('site-wide CTA analytics allowlist contains no PII fields', () => {
  const source = read('assets/sitewide-cta-tracking.js');
  assert.doesNotMatch(source, /email|company|phone|full_name/);
  assert.match(source, /cta_impression/);
  assert.match(source, /cta_click/);
});

test('site-wide CTA preserves existing Whitepaper and Preview contracts', () => {
  assert.match(read('whitepaper/index.html'), /data-cta-id="whitepaper_free_2026"/);
  assert.match(read('report/src/preview-cta-contract.js'), /localgeo\.coaretail\.com/);
  assert.match(read('report/src/preview-cta-contract.js'), /utm_campaign/);
});
