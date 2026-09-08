import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  QUERY_INVENTORY,
  PRIORITY_THEMES,
  THEME_BACKLOG,
  COMMERCIAL_CTA_ROUTES,
} from '../lib/purchase-intent-topics.mjs';
import {
  selectRelatedInsights,
  PROTECTED_INTERNAL_LINK_SLUGS,
} from '../lib/insights-related-links.mjs';
import { resolveServiceView } from '../lib/measurement/event-dictionary.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('ARI-P2-01 query inventory labels hypotheses and avoids invented search volume', () => {
  assert.ok(QUERY_INVENTORY.length >= 5);
  const hypothesis = QUERY_INVENTORY.filter((q) => q.status === 'hypothesis');
  assert.ok(hypothesis.length >= 1);
  for (const row of QUERY_INVENTORY) {
    assert.ok(row.primaryPath.startsWith('/') || row.primaryPath.startsWith('http'));
    assert.doesNotMatch(JSON.stringify(row), /検索ボリューム|月間\d+検索/);
  }
});

test('ARI-P2-01 three priority themes have public guide pages with steps and service links', () => {
  assert.equal(PRIORITY_THEMES.length, 3);
  for (const theme of PRIORITY_THEMES) {
    const file = theme.path.replace(/^\//, '') + 'index.html';
    const html = read(file);
    assert.match(html, /rel="canonical"/);
    assert.match(html, /手順/);
    assert.match(html, /¥29,800|29,800/);
    assert.match(html, /data-funnel-cta/);
    assert.match(html, /href="\/report\/"/);
    assert.doesNotMatch(html, /AggregateRating/);
  }
  const hub = read('guides/index.html');
  assert.match(hub, /購入前ガイド/);
  for (const theme of PRIORITY_THEMES) {
    assert.match(hub, new RegExp(theme.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('ARI-P2-01 guides link to evidence and do not claim AI-measured scores on free check', () => {
  const chatgpt = read('guides/chatgpt-visibility-check/index.html');
  assert.match(chatgpt, /#company-check/);
  assert.match(chatgpt, /手がかり|スコアではありません/);
  assert.match(chatgpt, /\/research\//);
  assert.match(chatgpt, /\/insights\/blind\//);
  const pricing = read('guides/ai-search-services/index.html');
  assert.match(pricing, /\/services\//);
  assert.match(pricing, /月額 ¥60,000/);
  assert.match(pricing, /未確認/);
});

test('ARI-P2-01 insights route purchase intent to guides with segmented CTAs', () => {
  const blind = read('insights/blind/index.html');
  assert.match(blind, /guides\/chatgpt-visibility-check/);
  assert.match(blind, /data-cta-type="CHECK"/);
  assert.match(blind, /data-cta-type="REPORT"/);
  const ari = read('insights/ari-vs-geo-seo/index.html');
  assert.match(ari, /guides\/ai-search-services/);
  assert.match(ari, /href="\/services\/"/);
  const comp = read('insights/competitor-blind-spot/index.html');
  assert.match(comp, /guides\/inhouse-vs-outsource/);
  assert.match(comp, /data-cta-type="CONSULT"/);
});

test('ARI-P2-01 related insights graph adds purchase-path links without ABIS slugs', () => {
  const fromBlind = selectRelatedInsights('blind', { mode: 'published' });
  assert.ok(fromBlind.some((r) => r.slug === 'ari-vs-geo-seo'));
  const fromComp = selectRelatedInsights('competitor-blind-spot', { mode: 'published' });
  assert.ok(fromComp.some((r) => r.slug === 'blind'));
  for (const slug of ['blind', 'ari-vs-geo-seo', 'competitor-blind-spot']) {
    const related = selectRelatedInsights(slug, { mode: 'published' });
    for (const r of related) {
      assert.ok(!PROTECTED_INTERNAL_LINK_SLUGS.has(r.slug), `${slug} -> ${r.slug}`);
      assert.doesNotMatch(r.href, /_scheduled/);
    }
  }
});

test('ARI-P2-01 sitemap build and service_view include guides paths', () => {
  const sitemap = read('sitemap.xml');
  assert.match(sitemap, /readiness\.coaretail\.com\/guides\/ai-search-services\//);
  assert.match(sitemap, /readiness\.coaretail\.com\/guides\/chatgpt-visibility-check\//);
  assert.match(sitemap, /readiness\.coaretail\.com\/guides\/inhouse-vs-outsource\//);
  const pkg = read('package.json');
  assert.match(pkg, /public_build\/guides/);
  assert.deepEqual(resolveServiceView('/guides/ai-search-services/'), {
    serviceKind: 'purchase_guide',
    serviceId: 'guides',
  });
  const ga4 = read('assets/ga4.js');
  assert.match(ga4, /purchase_guide/);
});

test('ARI-P2-01 commercial CTA routes preserve pricing contracts', () => {
  assert.match(COMMERCIAL_CTA_ROUTES.companyUrl.label, /29,800/);
  assert.match(COMMERCIAL_CTA_ROUTES.storeLocal.label, /60,000/);
  assert.equal(COMMERCIAL_CTA_ROUTES.consult.href, 'https://www.coaretail.com/readiness/mtgschedule');
});

test('ARI-P2-01 backlog documents deferred themes without duplicate pages', () => {
  assert.ok(THEME_BACKLOG.length >= 2);
  const guidePaths = PRIORITY_THEMES.map((t) => t.path);
  for (const item of THEME_BACKLOG) {
    assert.ok(!guidePaths.includes(item.path), `backlog path should not duplicate guide: ${item.path}`);
  }
});

test('ARI-P2-01 no links from guides to insights _scheduled paths', () => {
  for (const theme of PRIORITY_THEMES) {
    const html = read(theme.path.replace(/^\//, '') + 'index.html');
    assert.doesNotMatch(html, /insights\/_scheduled/);
  }
});
