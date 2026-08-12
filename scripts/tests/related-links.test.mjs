#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROTECTED_INTERNAL_LINK_SLUGS,
  getAvailableRelatedCandidates,
  isProtectedInternalLinkSlug,
  scoreRelatedCandidate,
  selectRelatedInsights,
  validateInternalLinks,
  applyInternalLinksToHtml,
  buildRelatedInsightsSectionHtml,
  stripRelatedInsightsBlocks,
  countRelatedInsightsBlocks,
} from '../lib/insights-related-links.mjs';

test('protected ABIS slugs are excluded from candidates', () => {
  for (const slug of PROTECTED_INTERNAL_LINK_SLUGS) {
    assert.equal(isProtectedInternalLinkSlug(slug), true);
    assert.equal(selectRelatedInsights(slug, { mode: 'published' }).length, 0);
  }
  const available = getAvailableRelatedCandidates('llms-txt', { mode: 'published' });
  for (const slug of PROTECTED_INTERNAL_LINK_SLUGS) {
    assert.equal(available.includes(slug), false);
  }
});

test('selectRelatedInsights returns 1-3 non-self links for published llms-txt', () => {
  const related = selectRelatedInsights('llms-txt', { mode: 'published' });
  assert.ok(related.length >= 1 && related.length <= 3);
  assert.ok(related.every((r) => r.slug !== 'llms-txt'));
  assert.ok(related.every((r) => !PROTECTED_INTERNAL_LINK_SLUGS.has(r.slug)));
  assert.match(related[0].anchor, /Schema|llms|robots/i);
});

test('scheduled ari-vs-geo-seo only links publish-time available slugs', () => {
  const related = selectRelatedInsights('ari-vs-geo-seo', {
    mode: 'scheduled',
    publishAt: '2026-08-04T10:00:00+09:00',
  });
  assert.ok(related.length >= 1);
  assert.ok(!related.some((r) => PROTECTED_INTERNAL_LINK_SLUGS.has(r.slug)));
});

test('scoreRelatedCandidate prefers same topic family', () => {
  const same = scoreRelatedCandidate('llms-txt', 'schema');
  const diff = scoreRelatedCandidate('llms-txt', 'why-ari');
  assert.ok(same > diff);
});

test('applyInternalLinksToHtml inserts section before article-cta', () => {
  const html = `<div class="article-body"><div class="article-container"><p>Body</p><div class="article-cta"><a href="/framework/">Framework</a><a href="/research/">Research</a><a href="/report/">ARI</a></div></div></div>`;
  const { html: out, related } = applyInternalLinksToHtml(html, 'llms-txt', { mode: 'published' });
  assert.ok(related.length >= 1);
  assert.ok(out.includes('related-insights'));
  assert.ok(out.indexOf('related-insights') < out.indexOf('article-cta'));
});

test('protected slug apply is no-op', () => {
  const html = '<div class="article-cta"></div>';
  const { changed, skipped } = applyInternalLinksToHtml(html, 'abis-intro', { mode: 'scheduled' });
  assert.equal(changed, false);
  assert.equal(skipped, 'protected');
});

test('buildRelatedInsightsSectionHtml uses meaningful anchors', () => {
  const section = buildRelatedInsightsSectionHtml([
    { slug: 'schema', href: '/insights/schema/', anchor: 'Schema.orgとllms.txt' },
  ]);
  assert.ok(section.includes('Schema.org'));
  assert.ok(!section.includes('こちら'));
});

test('validateInternalLinks catches self and protected targets', () => {
  const badSelf = `<section class="related-insights"><ul><li><a href="/insights/act/">x</a></ul></section><div class="article-cta"><a href="/framework/"></a><a href="/research/"></a><a href="/report/"></a></div>`;
  const errs = validateInternalLinks(badSelf, 'act', { mode: 'published' });
  assert.ok(errs.some((e) => e.includes('self-link') || e.includes('unavailable')));
});

test('stripRelatedInsightsBlocks removes section and legacy bare h2+ul duplicates', () => {
  const html = `<p>Body</p>
<h2>関連Insights</h2><ul><li><a href="/insights/a/">A</a></li></ul>
<h2>関連Insights</h2><ul><li><a href="/insights/a/">A</a></li></ul>
<section class="related-insights"><h2>関連Insights</h2><ul><li><a href="/insights/a/">A</a></li></ul></section>
<div class="article-cta"></div>`;
  const out = stripRelatedInsightsBlocks(html);
  assert.equal(countRelatedInsightsBlocks(out).total, 0);
});

test('applyInternalLinksToHtml is idempotent and leaves a single related section', () => {
  const html = `<div class="article-container"><p>Body</p>
<h2>関連Insights</h2><ul><li><a href="/insights/schema/">Schema</a></li></ul>
<h2>関連Insights</h2><ul><li><a href="/insights/schema/">Schema</a></li></ul>
<div class="article-cta"><a href="/framework/">Framework</a><a href="/research/">Research</a><a href="/report/">ARI</a></div></div>`;
  const first = applyInternalLinksToHtml(html, 'llms-txt', { mode: 'published' });
  const second = applyInternalLinksToHtml(first.html, 'llms-txt', { mode: 'published' });
  const counts = countRelatedInsightsBlocks(second.html);
  assert.equal(counts.sections, 1);
  assert.equal(counts.bare, 0);
  assert.ok(first.changed);
  assert.equal(second.changed, false);
});
