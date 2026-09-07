import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { classifyEditorialIntent } from '../lib/editorial-intent.mjs';

const root = process.cwd();
const schedule = JSON.parse(fs.readFileSync(path.join(root, 'insights/_scheduled/schedule.json'), 'utf8'));
const bySlug = new Map(schedule.articles.map((article) => [article.slug, article]));
const launch = [
  ['competitors-visible-company-missing', 'PROBLEM_AWARE'],
  ['seo-meo-ai-recommendation-gap', 'PROBLEM_AWARE'],
  ['html-observation-check-limits', 'EVIDENCE'],
  ['openai-product-discovery-agentic-commerce', 'NEWS'],
];

function readArticle(slug) {
  return fs.readFileSync(path.join(root, 'insights/_scheduled', slug, 'index.html'), 'utf8');
}

test('Phase 9F launch inventory reaches 3/1/1 without publishing drafts', () => {
  const eligible = schedule.articles.filter((article) => ['scheduled', 'editorial_hold', 'ready_for_schedule'].includes(article.status));
  const counts = Object.fromEntries(['PROBLEM_AWARE', 'EVIDENCE', 'NEWS'].map((intent) => [intent, 0]));
  for (const article of eligible) {
    const intent = classifyEditorialIntent(article);
    if (counts[intent] !== undefined) counts[intent] += 1;
  }
  assert.deepEqual(counts, { PROBLEM_AWARE: 3, EVIDENCE: 1, NEWS: 1 });
  for (const [slug] of launch) assert.equal(bySlug.get(slug).status, 'editorial_hold');
  for (const [slug] of launch) assert.equal(bySlug.get(slug).publishAt, null);
});

test('Phase 9F drafts have unique canonical URLs and intent metadata', () => {
  const urls = launch.map(([slug]) => {
    const meta = bySlug.get(slug);
    assert.equal(meta.editorialIntent, launch.find(([candidate]) => candidate === slug)[1]);
    const html = readArticle(slug);
    assert.match(html, new RegExp(`data-article-slug="${slug}"`));
    assert.match(html, new RegExp(`data-editorial-intent="${meta.editorialIntent}"`));
    assert.match(html, new RegExp(`/insights/${slug}/`));
    return `https://readiness.coaretail.com/insights/${slug}/`;
  });
  assert.equal(new Set(urls).size, urls.length);
});

test('problem and evidence CTAs route to Check, with bounded secondary paths', () => {
  for (const slug of ['competitors-visible-company-missing', 'seo-meo-ai-recommendation-gap', 'html-observation-check-limits']) {
    const html = readArticle(slug);
    assert.match(html, /href="\/#company-check"[^>]*data-cta-type="CHECK"/);
  }
  assert.match(readArticle('html-observation-check-limits'), /data-cta-type="REPORT"/);
  assert.match(readArticle('seo-meo-ai-recommendation-gap'), /https:\/\/localgeo\.coaretail\.com\//);
});

test('evidence and news claims include source discipline', () => {
  const evidence = bySlug.get('html-observation-check-limits');
  const news = bySlug.get('openai-product-discovery-agentic-commerce');
  assert.equal(evidence.sourceMetadata.type, 'repository observation');
  assert.match(readArticle(evidence.slug), /scripts\/tests\/phase9b-public-check\.test\.mjs/);
  assert.equal(news.sourceMetadata.type, 'official announcement');
  assert.equal(news.sourceMetadata.date, '2026-03-24');
  assert.match(readArticle(news.slug), /openai\.com\/index\/powering-product-discovery-in-chatgpt/);
});

test('new social assets are channel-specific and not queued', () => {
  for (const [slug] of launch) {
    const x = fs.readFileSync(path.join(root, 'insights/_social/x/posts', `${slug}.md`), 'utf8');
    const linkedin = fs.readFileSync(path.join(root, 'insights/_social/linkedin/posts', `${slug}.md`), 'utf8');
    const facebook = fs.readFileSync(path.join(root, 'insights/_social/facebook/posts', `${slug}.md`), 'utf8');
    assert.notEqual(x, linkedin);
    assert.notEqual(linkedin, facebook);
    assert.match(x + linkedin + facebook, new RegExp(`/insights/${slug}/`));
  }
  const queue = JSON.parse(fs.readFileSync(path.join(root, 'insights/_social/buffer/queue.json'), 'utf8'));
  for (const [slug] of launch) assert.equal(queue.posts.some((post) => post.slug === slug), false);
});
