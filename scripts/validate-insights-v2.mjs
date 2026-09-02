#!/usr/bin/env node
/**
 * Validation for Agent Readiness Insights v2.
 * Usage: node scripts/validate-insights-v2.mjs [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, ROOT, articleUrl } from './lib/insights-v2-paths.mjs';
import { charCountNoSpace } from './lib/business-days.mjs';
import { getBufferConfig, isBufferConfigured } from './lib/buffer-client.mjs';
import {
  EDITORIAL_STATUSES,
  INITIAL_SLUG,
  extractDueArticles,
  isBufferEligible,
} from './lib/editorial-status.mjs';
import { toJstDateString } from './lib/business-days.mjs';
import { detectHtmlQualityIssues } from './lib/article-quality.mjs';
import { getScheduledSeoPackage, validateInsightSeo } from './lib/insights-seo-package.mjs';
import { findEarliestScheduledArticle } from './lib/unlock-next-insight.mjs';
import { duplicateBufferLedgerKeys } from './lib/buffer-ledger.mjs';

const jsonOut = process.argv.includes('--json');
const results = { pass: [], review: [], fail: [], blocking: [], nonBlocking: [] };

function add(level, cat, msg) {
  results[level].push({ category: cat, message: msg });
  if (level === 'fail') results.blocking.push(msg);
  else if (level === 'review') results.nonBlocking.push(msg);
}

function readJson(p) {
  if (!fs.existsSync(p)) throw new Error(`Missing ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function validateArticles() {
  const plan = readJson(PATHS.editorialPlan);
  const content = readJson(PATHS.articlesContent);
  if (content.articles.length !== 30) add('fail', 'articles', `Expected 30 articles, got ${content.articles.length}`);

  const titles = new Set();
  for (const a of content.articles) {
    const n = charCountNoSpace(a.body);
    if (n < 2000 || n > 2700) add('review', 'articles', `${a.slug} char count ${n}`);
    if (!a.body.includes('##')) add('fail', 'articles', `${a.slug} missing H2`);
    if (titles.has(a.title)) add('fail', 'articles', `Duplicate title: ${a.title}`);
    titles.add(a.title);

    const mdPath = path.join(PATHS.columnDir, `${a.slug}.md`);
    if (!fs.existsSync(mdPath)) add('fail', 'articles', `Missing MD: ${a.slug}`);

    const liPath = path.join(PATHS.linkedinDir, `${a.slug}.md`);
    const gitLiPath = path.join(ROOT, 'insights/_social/linkedin/posts', `${a.slug}.md`);
    if (!fs.existsSync(liPath) && !fs.existsSync(gitLiPath)) add('fail', 'linkedin', `Missing LinkedIn: ${a.slug}`);
    else {
      const li = fs.readFileSync(fs.existsSync(gitLiPath) ? gitLiPath : liPath, 'utf8');
      const lnc = charCountNoSpace(li);
      if (lnc < 450 || lnc > 900) add('review', 'linkedin', `${a.slug} linkedin length ${lnc}`);
      const tags = (li.match(/#\w+/g) || []).length;
      if (tags < 2 || tags > 5) add('review', 'linkedin', `${a.slug} hashtag count ${tags}`);
      if (!li.includes('#AgentReadiness')) add('fail', 'linkedin', `${a.slug} missing #AgentReadiness`);
      if (!li.includes(articleUrl(a.slug))) add('fail', 'linkedin', `${a.slug} URL mismatch`);
    }
  }

  // Duplication vs existing
  const existing = readJson(PATHS.schedule).articles.filter((a) => !a.series || a.series !== 'v2');
  for (const v2 of plan.articles) {
    for (const ex of existing) {
      if (ex.title === v2.title) add('fail', 'dup', `Title collision with existing: ${v2.slug}`);
      if (ex.slug === v2.slug) add('fail', 'dup', `Slug collision: ${v2.slug}`);
    }
  }
}

function validateHtml() {
  const plan = readJson(PATHS.editorialPlan);
  const schedule = readJson(PATHS.schedule);
  const publishedSlugs = new Set(
    schedule.articles.filter((a) => a.status === EDITORIAL_STATUSES.PUBLISHED).map((a) => a.slug)
  );

  for (const a of plan.articles) {
    if (publishedSlugs.has(a.slug)) {
      const livePath = path.join(ROOT, 'insights', a.slug, 'index.html');
      if (!fs.existsSync(livePath)) {
        add('fail', 'html', `Published but missing live HTML: ${a.slug}`);
      }
      continue;
    }

    const htmlPath = path.join(PATHS.scheduledDir, a.slug, 'index.html');
    if (!fs.existsSync(htmlPath)) {
      add('fail', 'html', `Missing HTML: ${a.slug}`);
      continue;
    }
    const html = fs.readFileSync(htmlPath, 'utf8');
    const url = articleUrl(a.slug);
    if (!html.includes(`href="${url}"`) && !html.includes(url)) add('fail', 'html', `${a.slug} canonical missing`);
    if (html.includes('noindex')) add('fail', 'html', `${a.slug} has noindex`);
    if (!html.includes('BlogPosting')) add('fail', 'html', `${a.slug} missing JSON-LD`);
    if (!html.includes('article-cta')) add('fail', 'html', `${a.slug} missing CTA`);

    if (getScheduledSeoPackage(a.slug)) {
      for (const msg of validateInsightSeo(html, a.slug, { scheduled: true })) {
        add('fail', 'seo', msg);
      }
    }
  }

  const scheduled = schedule.articles.find(
    (a) => a.series === 'v2' && a.status === EDITORIAL_STATUSES.SCHEDULED
  );
  if (scheduled) {
    const htmlPath = path.join(PATHS.scheduledDir, scheduled.slug, 'index.html');
    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, 'utf8');
      const issues = detectHtmlQualityIssues(html, { slug: scheduled.slug });
      for (const issue of issues) {
        add(
          'fail',
          'quality',
          `${scheduled.slug} ${issue.code}${issue.count ? ` (${issue.count})` : issue.title ? `: ${issue.title}` : ''}`
        );
      }
    }
  }

  const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
  if (!pkg.includes('_scheduled')) add('review', 'build', 'Verify build:all excludes _scheduled');
}

function validateSchedule() {
  const schedule = readJson(PATHS.schedule);
  const v2 = schedule.articles.filter((a) => a.series === 'v2');
  if (v2.length !== 30) add('fail', 'schedule', `Expected 30 v2 schedule entries, got ${v2.length}`);

  const scheduled = v2.filter((a) => a.status === EDITORIAL_STATUSES.SCHEDULED);
  const hold = v2.filter((a) => a.status === EDITORIAL_STATUSES.HOLD);
  const published = v2.filter((a) => a.status === EDITORIAL_STATUSES.PUBLISHED);

  if (scheduled.length !== 1) add('fail', 'gate', `Expected 1 scheduled v2 article, got ${scheduled.length}`);
  const expectedHold = 30 - scheduled.length - published.length;
  if (hold.length !== expectedHold) {
    add('fail', 'gate', `Expected ${expectedHold} editorial_hold v2 articles, got ${hold.length} (published=${published.length})`);
  }

  const active = scheduled[0];
  if (!active) add('fail', 'gate', 'No scheduled v2 article');
  else if (!active.publishAt) {
    add('fail', 'gate', `${active.slug} must have publishAt`);
  } else if (!active.publishAt.includes('+09:00')) {
    add('fail', 'gate', `${active.slug} publishAt must be JST (+09:00)`);
  }

  for (const a of hold) {
    if (a.publishAt) add('fail', 'gate', `editorial_hold ${a.slug} must not have publishAt`);
  }

  if (active?.publishAt) {
    const due = extractDueArticles(v2, new Date(active.publishAt));
    if (due.length !== 1 || due[0].slug !== active.slug) {
      add('fail', 'gate', `Publish script would target ${due.length} articles at ${active.publishAt}`);
    }
  }

  const dueHold = extractDueArticles(
    v2.map((a) => ({ ...a, status: EDITORIAL_STATUSES.HOLD, publishAt: active?.publishAt })),
    new Date(active?.publishAt || '2099-01-01T10:00:00+09:00')
  );
  if (dueHold.length !== 0) add('fail', 'gate', 'editorial_hold articles must not be publish-eligible');
}

function validateQueue() {
  const queue = readJson(PATHS.linkedinQueue);
  if (queue.policy.postsPerTransfer !== 1) add('fail', 'queue', 'postsPerTransfer must be 1');
  const duplicateKeys = duplicateBufferLedgerKeys(queue.posts);
  if (duplicateKeys.length) {
    add('fail', 'queue', `Duplicate canonical identities: ${duplicateKeys.join(', ')}`);
  }

  const scheduled = queue.posts.filter((p) => p.status === EDITORIAL_STATUSES.SCHEDULED);
  const hold = queue.posts.filter((p) => p.status === EDITORIAL_STATUSES.HOLD);
  const queued = queue.posts.filter((p) => p.status === 'buffer_queued');

  if (scheduled.length !== 1) {
    add('fail', 'gate', `Expected 1 scheduled LinkedIn post, got ${scheduled.length}`);
  }
  const expectedHold = queue.posts.length - scheduled.length - queued.length;
  if (hold.length !== expectedHold) {
    add('fail', 'gate', `Expected ${expectedHold} editorial_hold LinkedIn posts, got ${hold.length} (buffer_queued=${queued.length})`);
  }

  const active = scheduled[0];
  if (!active) add('fail', 'gate', 'No scheduled LinkedIn post');
  else {
    if (!active.articlePublishAt) add('fail', 'gate', `${active.slug} missing articlePublishAt`);
    if (!active.bufferTransferAt) add('fail', 'gate', `${active.slug} missing bufferTransferAt`);
    if (!active.linkedinPublishAt) add('fail', 'gate', `${active.slug} missing linkedinPublishAt`);
    if (active.articlePublishAt && active.bufferTransferAt) {
      const gap =
        new Date(active.bufferTransferAt).getTime() - new Date(active.articlePublishAt).getTime();
      if (gap < 25 * 60_000) add('fail', 'gate', 'Buffer must be at least 25min after Web publish');
    }
  }

  for (const p of hold) {
    if (p.articlePublishAt) add('fail', 'gate', `editorial_hold ${p.slug} must not have articlePublishAt`);
    if (p.bufferTransferAt) add('fail', 'gate', `editorial_hold ${p.slug} must not have bufferTransferAt`);
    if (p.linkedinPublishAt) add('fail', 'gate', `editorial_hold ${p.slug} must not have linkedinPublishAt`);
    if (isBufferEligible(p)) add('fail', 'gate', `editorial_hold ${p.slug} must not be buffer-eligible`);
  }

  if (active?.bufferTransferAt) {
    const gateDay = toJstDateString(new Date(active.bufferTransferAt));
    const bufferCandidates = queue.posts.filter((p) => {
      if (p.status === EDITORIAL_STATUSES.HOLD || !p.bufferTransferAt) return false;
      return toJstDateString(new Date(p.bufferTransferAt)) === gateDay && isBufferEligible(p);
    });
    if (bufferCandidates.length !== 1 || bufferCandidates[0].slug !== active.slug) {
      add('fail', 'gate', `Buffer dispatcher would pick ${bufferCandidates.length} posts on transfer day`);
    }
  }

  const slugs = new Set();
  const urls = new Set();
  for (const p of queue.posts) {
    if (slugs.has(p.slug)) add('fail', 'queue', `Duplicate slug ${p.slug}`);
    slugs.add(p.slug);
    if (urls.has(p.articleUrl)) add('fail', 'queue', `Duplicate URL ${p.articleUrl}`);
    urls.add(p.articleUrl);
    if (p.bufferUpdateId) add('review', 'queue', `${p.slug} already has bufferUpdateId`);
  }
}

function validateIndexPlannedCards() {
  const schedule = readJson(PATHS.schedule);
  const scheduled = findEarliestScheduledArticle(schedule);
  const holdSlugs = schedule.articles.filter((a) => a.status === EDITORIAL_STATUSES.HOLD).map((a) => a.slug);
  const html = fs.readFileSync(PATHS.insightsIndex, 'utf8');

  for (const slug of holdSlugs) {
    if (html.includes(`data-scheduled-slug="${slug}"`)) {
      add('fail', 'gate', `index.html shows editorial_hold article as planned: ${slug}`);
    }
  }

  if (scheduled && !html.includes(`data-scheduled-slug="${scheduled.slug}"`)) {
    add('fail', 'gate', `index.html must show planned card for ${scheduled.slug}`);
  }

  const plannedCount = (html.match(/class="insight-card planned"/g) || []).length;
  if (plannedCount !== 1) add('fail', 'gate', `Expected 1 planned card in index.html, found ${plannedCount}`);
}

function validateBufferDispatcher() {
  if (!isBufferConfigured()) add('review', 'buffer', 'BUFFER credentials not configured (expected for local)');
  add('pass', 'buffer', 'queue-daily-linkedin-buffer.mjs exists');
  add('pass', 'buffer', 'queue-daily-buffer-posts.mjs exists');
}

function validateBufferQueue() {
  if (!fs.existsSync(PATHS.bufferQueue)) {
    add('fail', 'buffer-queue', 'Missing insights/_social/buffer/queue.json — run init-buffer-queue.mjs');
    return;
  }

  const queue = readJson(PATHS.bufferQueue);
  if (queue.policy.postsPerTransfer !== 1) add('fail', 'buffer-queue', 'postsPerTransfer must be 1');
  const duplicateKeys = duplicateBufferLedgerKeys(queue.posts);
  if (duplicateKeys.length) {
    add('fail', 'buffer-queue', `Duplicate canonical identities: ${duplicateKeys.join(', ')}`);
  }

  const scheduled = queue.posts.filter((p) => p.status === EDITORIAL_STATUSES.SCHEDULED);
  const hold = queue.posts.filter((p) => p.status === EDITORIAL_STATUSES.HOLD);
  const partial = queue.posts.filter((p) => p.status === 'partially_queued');
  const queued = queue.posts.filter((p) => p.status === 'buffer_queued');

  if (scheduled.length !== 1) {
    add('fail', 'buffer-queue', `Expected 1 scheduled buffer post, got ${scheduled.length}`);
  }
  if (partial.length > 1) {
    add('fail', 'buffer-queue', `Expected at most 1 partially_queued post, got ${partial.length}`);
  }
  const expectedHold = queue.posts.length - scheduled.length - partial.length - queued.length;
  if (hold.length !== expectedHold) {
    add('fail', 'buffer-queue', `Expected ${expectedHold} editorial_hold buffer posts, got ${hold.length} (partial=${partial.length} queued=${queued.length})`);
  }

  const active = scheduled[0];
  if (!active?.channels) add('fail', 'buffer-queue', 'Scheduled buffer post missing channels');

  for (const ch of ['linkedin', 'facebook', 'x']) {
    const envName = ch === 'x' ? 'BUFFER_CHANNEL_ID_TWITTER' : `BUFFER_CHANNEL_ID_${ch.toUpperCase()}`;
    const c = active?.channels?.[ch];
    if (!c) add('fail', 'buffer-queue', `${active?.slug || 'scheduled'} missing channel ${ch}`);
    else {
      if (ch === 'linkedin' && c.channelIdEnv !== 'BUFFER_CHANNEL_ID_LINKEDIN') {
        add('fail', 'buffer-queue', 'linkedin channelIdEnv must be BUFFER_CHANNEL_ID_LINKEDIN');
      }
      if (ch === 'x' && c.channelIdEnv !== 'BUFFER_CHANNEL_ID_TWITTER') {
        add('fail', 'buffer-queue', `${ch} channelIdEnv must be BUFFER_CHANNEL_ID_TWITTER`);
      }
      if (!c.contentFile?.includes(`/${ch === 'x' ? 'x' : ch}/posts/`)) {
        add('fail', 'buffer-queue', `${ch} contentFile path invalid`);
      }
      const abs = path.join(ROOT, c.contentFile);
      if (!fs.existsSync(abs)) add('fail', 'buffer-queue', `Missing ${ch} content: ${c.contentFile}`);

      if (ch === 'x' && fs.existsSync(abs)) {
        const text = fs.readFileSync(abs, 'utf8');
        if (text.length > 250) add('fail', 'buffer-queue', `${active.slug} X post exceeds 250 chars (${text.length})`);
        if (text.length < 80) add('review', 'buffer-queue', `${active.slug} X post short (${text.length})`);
      }
      if (!c.contentFile || !active?.articleUrl || !fs.existsSync(abs)) continue;
      const body = fs.readFileSync(abs, 'utf8');
      if (!body.includes(active.articleUrl)) add('fail', 'buffer-queue', `${active.slug} ${ch} URL mismatch`);
    }
  }

  if (active?.channels?.linkedin?.bufferUpdateId) {
    add('review', 'buffer-queue', `${active.slug} LinkedIn already has bufferUpdateId`);
  }

  for (const p of hold) {
    if (p.articlePublishAt) add('fail', 'buffer-queue', `editorial_hold ${p.slug} must not have articlePublishAt`);
    if (p.bufferTransferAt) add('fail', 'buffer-queue', `editorial_hold ${p.slug} must not have bufferTransferAt`);
  }

  if (active?.bufferTransferAt) {
    const gateDay = toJstDateString(new Date(active.bufferTransferAt));
    const bufferCandidates = queue.posts.filter((p) => {
      if (p.status === EDITORIAL_STATUSES.HOLD || !p.bufferTransferAt) return false;
      return toJstDateString(new Date(p.bufferTransferAt)) === gateDay;
    });
    if (bufferCandidates.length !== 1) {
      add('fail', 'buffer-queue', `Buffer dispatcher would pick ${bufferCandidates.length} posts on transfer day`);
    }
  }
}

function validateSocialContentFiles() {
  const queue = readJson(PATHS.bufferQueue);
  for (const p of queue.posts) {
    for (const ch of ['facebook', 'x']) {
      const rel = p.channels?.[ch]?.contentFile;
      if (!rel) continue;
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) add('fail', 'social', `Missing ${ch} post: ${p.slug}`);
    }
  }
}

function main() {
  try {
    validateArticles();
    validateHtml();
    validateSchedule();
    validateQueue();
    validateBufferQueue();
    validateSocialContentFiles();
    validateIndexPlannedCards();
    validateBufferDispatcher();
  } catch (err) {
    add('fail', 'system', String(err.message));
  }

  const summary = {
    pass: results.pass.length,
    review: results.review.length,
    fail: results.fail.length,
    blocking: results.blocking,
    nonBlocking: results.nonBlocking,
    ok: results.fail.length === 0,
  };

  if (jsonOut) {
    console.log(JSON.stringify({ summary, details: results }, null, 2));
  } else {
    console.log('Validation:', summary.ok ? 'PASS' : 'FAIL');
    console.log(' fail:', results.fail.length, 'review:', results.review.length);
    for (const f of results.fail) console.log(' FAIL', f.category, f.message);
    for (const r of results.review) console.log(' REVIEW', r.category, r.message);
  }
  process.exit(summary.ok ? 0 : 1);
}

main();
