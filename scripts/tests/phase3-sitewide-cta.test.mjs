import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CTA_TYPES } from '../lib/funnel/cta.mjs';
import { getInsightCtaProfile, renderInsightCtaHtml, injectInsightCta } from '../lib/funnel/sitewide-cta.mjs';

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

test('published Insights with a sitewide CTA include mapping metadata and tracking', () => {
  const dirs = fs.readdirSync(path.join(ROOT, 'insights'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name)
    .filter((slug) => fs.existsSync(path.join(ROOT, 'insights', slug, 'index.html')));
  const withCta = dirs.filter((slug) => read(`insights/${slug}/index.html`).includes(`data-cta-profile="${slug}"`));
  assert.ok(withCta.length >= 40, `expected most published Insights to have sitewide CTA, got ${withCta.length}`);
  for (const slug of withCta) {
    const html = read(`insights/${slug}/index.html`);
    assert.match(html, /data-funnel-cta/, slug);
    assert.match(html, /sitewide-cta-tracking\.js/, slug);
    assert.match(html, /sitewide-cta\.css/, slug);
  }
});

test('Insight generator imports the shared mapping and emits future CTA metadata', () => {
  const source = read('scripts/generate-insight-article.mjs');
  assert.match(source, /lib\/funnel\/sitewide-cta\.mjs/);
  assert.match(source, /renderInsightCtaHtml\(/);
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

test('shared sitewide CTA CSS beats article-body link color on navy buttons', () => {
  const css = read('assets/sitewide-cta.css');
  assert.match(css, /\.article-body \.sitewide-cta a\.btn-navy[\s\S]*?color:\s*#FFFFFF/);
  assert.match(css, /\.article-body \.sitewide-cta a\.btn:not\(\.btn-secondary\)[\s\S]*?color:\s*#FFFFFF/);
  assert.match(css, /\.article-body \.sitewide-cta a\.btn-secondary[\s\S]*?color:\s*var\(--text, #09090B\)/);
});

test('Insight generator emits specificity-safe navy CTA color and loads shared CSS after inline styles', () => {
  const source = read('scripts/generate-insight-article.mjs');
  assert.match(source, /\.article-body a\.btn-navy/);
  const styleClose = source.indexOf('</style>');
  const cssLink = source.indexOf('href="/assets/sitewide-cta.css"');
  assert.ok(styleClose !== -1 && cssLink !== -1);
  assert.ok(cssLink > styleClose, 'sitewide-cta.css must load after the inline article style block');
});

test('injectInsightCta moves shared CSS after inline styles and patches navy contrast', () => {
  const html = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="/assets/sitewide-cta.css">
<style>
.article-body a { color: var(--text); }
.btn-navy { background: #0D1B3E; color: #FFFFFF; }
.article-cta .btn-navy,
.article-cta .btn-navy:hover { color: #FFFFFF; }
</style>
</head><body>
<div class="article-cta"></div>
</body></html>`;
  const after = injectInsightCta(html, 'contrast-fixture');
  const styleClose = after.indexOf('</style>');
  const cssLink = after.indexOf('href="/assets/sitewide-cta.css"');
  assert.ok(cssLink > styleClose);
  assert.match(after, /\.article-body a\.btn-navy/);
  assert.match(after, /data-cta-profile="contrast-fixture"/);
});

test('every Insight article with the body-link color rule has a navy CTA override and shared CSS after inline styles', () => {
  const walk = (dir) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (entry.name === 'index.html') out.push(full);
    }
    return out;
  };

  const files = walk(path.join(ROOT, 'insights')).filter((file) => !file.includes(`${path.sep}_social${path.sep}`));
  const withBodyLink = files.filter((file) => {
    const html = fs.readFileSync(file, 'utf8');
    return /\.article-body a\s*\{[^}]*color:\s*var\(--text\)/.test(html);
  });
  assert.ok(withBodyLink.length >= 60, `expected many Insight HTML files, got ${withBodyLink.length}`);

  for (const file of withBodyLink) {
    const html = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file);
    assert.match(html, /\.article-body a\.btn-navy/, rel);
    if (!html.includes('class="sitewide-cta"') && !html.includes('data-cta-profile=')) continue;
    const styleClose = html.lastIndexOf('</style>');
    const cssLink = html.indexOf('href="/assets/sitewide-cta.css"');
    assert.ok(cssLink !== -1, rel);
    assert.ok(cssLink > styleClose, `${rel} must load sitewide-cta.css after inline styles`);
  }

  const niq = read('insights/niq-similarweb-agentic-shelf-measurement/index.html');
  assert.match(niq, /無料ガイドを見る/);
  assert.match(niq, /class="btn btn-navy"/);
  assert.match(niq, /\.article-body a\.btn-navy/);
  assert.ok(niq.indexOf('href="/assets/sitewide-cta.css"') > niq.lastIndexOf('</style>'));
});
