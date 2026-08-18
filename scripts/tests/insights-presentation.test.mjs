import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  assertCanonicalInsightPresentation,
  validateCanonicalInsightPresentation,
} from '../lib/insights-presentation.mjs';

test('published IAB article uses the canonical Insight presentation', () => {
  const html = fs.readFileSync('insights/iab-ai-visibility/index.html', 'utf8');
  assert.deepEqual(validateCanonicalInsightPresentation(html), []);
});

test('next editorial-hold fixture uses the canonical presentation without publishing', () => {
  const html = fs.readFileSync('insights/_scheduled/faq-for-agents/index.html', 'utf8');
  assert.doesNotThrow(() => assertCanonicalInsightPresentation(html, { slug: 'faq-for-agents' }));
});

test('standalone article markup is rejected before publication', () => {
  const html = '<nav class="nav"></nav><article class="article-body"></article><footer></footer>';
  const missing = validateCanonicalInsightPresentation(html);
  assert.ok(missing.includes('header'));
  assert.ok(missing.includes('article_width'));
  assert.ok(missing.includes('footer'));
});
