#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeArticleBodyHtml,
  sanitizeArticleHtmlFile,
  detectHtmlQualityIssues,
  BOILERPLATE_TAIL,
} from '../lib/article-quality.mjs';

const SAMPLE = `<article class="article-body container">
<div class="article-container">
      <h2>引用と実行は別の成果指標</h2>
      <p>本文。</p>
      <h2>まとめ</h2>
      <p>引用はVisibility/Authority、実行はActionabilityの領域です。</p>
      <h2>引用と実行のギャップ診断</h2>
      <p>重複パディング。</p>
      <h2>まとめ</h2>
      <p>citation-vs-actionの要点は、引用はVisibility/Authority。</p>
      <h2>次の一手</h2>
      <p>定型。</p>
      <h2>情報設計の原則</h2>
      <p>定型。</p>
      <p>${BOILERPLATE_TAIL}</p>
      <p>${BOILERPLATE_TAIL}</p>
      <div class="article-cta">
        <h2>関連リソース</h2>
      </div>
</div>
</article>`;

test('detectHtmlQualityIssues flags boilerplate', () => {
  const issues = detectHtmlQualityIssues(SAMPLE, { slug: 'citation-vs-action' });
  assert.ok(issues.some((i) => i.code === 'boilerplate_tail'));
  assert.ok(issues.some((i) => i.code === 'duplicate_summary_h2'));
  assert.ok(issues.some((i) => i.code === 'slug_boilerplate_summary'));
});

test('sanitizeArticleHtmlFile removes boilerplate and keeps first summary', () => {
  const { html, changed, issues } = sanitizeArticleHtmlFile(SAMPLE, { slug: 'citation-vs-action' });
  assert.equal(changed, true);
  assert.equal(issues.length, 0);
  assert.match(html, /<h2>まとめ<\/h2>/);
  assert.doesNotMatch(html, /citation-vs-actionの要点は/);
  assert.doesNotMatch(html, /定点観測と更新ログの運用が/);
  assert.doesNotMatch(html, /<h2>次の一手<\/h2>/);
  assert.match(html, /<div class="article-cta">/);
});

test('sanitize keeps whitelisted 関連するInsights after summary', () => {
  const input = `<article class="article-body container">
<div class="article-container">
      <h2>まとめ</h2>
      <p>要点。</p>
      <h2>関連するInsights</h2>
      <ul><li><a href="/insights/exec/">検索から実行へ</a></li></ul>
      <div class="article-cta"></div>
</div>
</article>`;
  const { html, issues } = sanitizeArticleHtmlFile(input);
  assert.equal(issues.length, 0);
  assert.match(html, /関連するInsights/);
});
