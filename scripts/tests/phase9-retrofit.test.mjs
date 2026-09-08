import test from 'node:test';
import assert from 'node:assert/strict';
import { stubArticleToMarkdown } from '../lib/retrofit-phase9-stub-html.mjs';

test('stubArticleToMarkdown extracts lead and section body', () => {
  const html = `<article data-article-slug="demo"><h1>Title</h1><p>Lead text here.</p><h2>Section</h2><p>Body copy.</p><div class="note"><strong>出典：</strong>source</div></article>`;
  const out = stubArticleToMarkdown(html);
  assert.equal(out.lead, 'Lead text here.');
  assert.match(out.markdown, /## Section/);
  assert.match(out.markdown, /Body copy/);
  assert.match(out.markdown, /> \*\*出典：\*\*source/);
});
