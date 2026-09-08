/**
 * Convert Phase 9 stub articles into canonical Insight HTML via generate-insight-article.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT } from './insights-v2-paths.mjs';
import { loadSchedule } from './insights-related-links.mjs';
import { prepareScheduledArticle } from './prepare-scheduled-article.mjs';
import { validateSocialContentForSlug } from './validate-social-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

export const PHASE9_STUB_SLUGS = [
  'openai-product-discovery-agentic-commerce',
  'competitors-visible-company-missing',
  'html-observation-check-limits',
  'seo-meo-ai-recommendation-gap',
];

function stripTags(value) {
  return String(value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function inlineMarkdown(value) {
  return String(value || '')
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => `[${stripTags(label)}](${href})`)
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stubArticleToMarkdown(html) {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || '';
  const withoutH1 = article.replace(/<h1\b[\s\S]*?<\/h1>/i, '');
  const leadMatch = withoutH1.match(/^<p\b[^>]*>([\s\S]*?)<\/p>/i);
  const lead = inlineMarkdown(leadMatch?.[1] || '');
  let body = withoutH1.replace(/^<p\b[^>]*>[\s\S]*?<\/p>/i, '');
  body = body.replace(/<div class="cta"[\s\S]*?<\/div>/gi, '');
  body = body.replace(/<div class="note">([\s\S]*?)<\/div>/gi, (_, inner) => `> ${inlineMarkdown(inner)}\n\n`);

  const lines = [];
  const tokens = body.split(/(?=<h2\b|<h3\b|<p\b|<ul\b)/i).filter(Boolean);
  for (const token of tokens) {
    if (/^<h2\b/i.test(token)) {
      lines.push(`## ${inlineMarkdown(token.replace(/<\/?h2[^>]*>/gi, ''))}`);
      continue;
    }
    if (/^<h3\b/i.test(token)) {
      lines.push(`### ${inlineMarkdown(token.replace(/<\/?h3[^>]*>/gi, ''))}`);
      continue;
    }
    if (/^<ul\b/i.test(token)) {
      const items = [...token.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)];
      for (const item of items) lines.push(`- ${inlineMarkdown(item[1])}`);
      continue;
    }
    if (/^<p\b/i.test(token)) {
      lines.push(inlineMarkdown(token.replace(/<\/?p[^>]*>/gi, '')));
    }
  }

  return { lead, markdown: `${lines.join('\n\n')}\n` };
}

export function retrofitPhase9StubArticle(slug, { root = ROOT, dryRun = false } = {}) {
  const schedule = loadSchedule(root);
  const entry = schedule.articles.find((article) => article.slug === slug);
  if (!entry) throw new Error(`schedule_entry_missing:${slug}`);

  const htmlPath = path.join(root, 'insights/_scheduled', slug, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const { lead, markdown } = stubArticleToMarkdown(html);
  const publishDate = entry.publishAt?.slice(0, 10);
  if (!publishDate) throw new Error(`publish_date_missing:${slug}`);

  const draftDir = path.join(root, 'insights/_scheduled/_drafts', slug);
  const mdPath = path.join(draftDir, 'source.md');
  if (!dryRun) {
    fs.mkdirSync(draftDir, { recursive: true });
    fs.writeFileSync(mdPath, markdown, 'utf8');
    const result = spawnSync(
      process.execPath,
      [
        path.join(root, 'scripts/generate-insight-article.mjs'),
        '--md', mdPath,
        '--slug', slug,
        '--date', publishDate,
        '--out', path.join(root, 'insights/_scheduled', slug),
        '--lead', lead,
        '--editorial-intent', entry.editorialIntent || '',
      ],
      { cwd: root, encoding: 'utf8' },
    );
    if (result.status !== 0) {
      throw new Error(`generate_failed:${slug}:${result.stderr || result.stdout}`);
    }
  }

  const prepared = prepareScheduledArticle(slug, { strict: true, htmlPath });
  return { slug, publishDate, lead, prepared, dryRun };
}

export function retrofitPhase9StubArticles({ root = ROOT, dryRun = false } = {}) {
  const results = [];
  for (const slug of PHASE9_STUB_SLUGS) {
    results.push(retrofitPhase9StubArticle(slug, { root, dryRun }));
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes('--dry-run');
  const results = retrofitPhase9StubArticles({ dryRun });
  console.log(JSON.stringify(results.map((result) => ({
    slug: result.slug,
    ok: result.prepared.ok,
    error: result.prepared.error || result.prepared.message || null,
  })), null, 2));
  const failed = results.filter((result) => !result.prepared.ok);
  process.exit(failed.length ? 1 : 0);
}
