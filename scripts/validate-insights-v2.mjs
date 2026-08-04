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
  for (const a of plan.articles) {
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

  if (scheduled.length !== 1) add('fail', 'gate', `Expected 1 scheduled v2 article, got ${scheduled.length}`);
  if (hold.length !== 29) add('fail', 'gate', `Expected 29 editorial_hold v2 articles, got ${hold.length}`);

  const initial = scheduled.find((a) => a.slug === INITIAL_SLUG);
  if (!initial) add('fail', 'gate', `Scheduled article must be ${INITIAL_SLUG}`);
  else if (!initial.publishAt) {
    add('fail', 'gate', `${INITIAL_SLUG} must have publishAt`);
  } else if (!initial.publishAt.includes('+09:00')) {
    add('fail', 'gate', `${INITIAL_SLUG} publishAt must be JST (+09:00)`);
  }

  for (const a of hold) {
    if (a.publishAt) add('fail', 'gate', `editorial_hold ${a.slug} must not have publishAt`);
  }

  if (initial?.publishAt) {
    const due = extractDueArticles(v2, new Date(initial.publishAt));
    if (due.length !== 1 || due[0].slug !== INITIAL_SLUG) {
      add('fail', 'gate', `Publish script would target ${due.length} articles at ${initial.publishAt}`);
    }
  }

  const dueHold = extractDueArticles(
    v2.map((a) => ({ ...a, status: EDITORIAL_STATUSES.HOLD, publishAt: initial?.publishAt })),
    new Date(initial?.publishAt || '2099-01-01T10:00:00+09:00')
  );
  if (dueHold.length !== 0) add('fail', 'gate', 'editorial_hold articles must not be publish-eligible');
}

function validateQueue() {
  const queue = readJson(PATHS.linkedinQueue);
  if (queue.policy.postsPerTransfer !== 1) add('fail', 'queue', 'postsPerTransfer must be 1');
  if (queue.posts.length !== 30) add('fail', 'queue', `Expected 30 queue posts, got ${queue.posts.length}`);

  const scheduled = queue.posts.filter((p) => p.status === EDITORIAL_STATUSES.SCHEDULED);
  const hold = queue.posts.filter((p) => p.status === EDITORIAL_STATUSES.HOLD);

  if (scheduled.length !== 1) add('fail', 'gate', `Expected 1 scheduled LinkedIn post, got ${scheduled.length}`);
  if (hold.length !== 29) add('fail', 'gate', `Expected 29 editorial_hold LinkedIn posts, got ${hold.length}`);

  const initial = scheduled.find((p) => p.slug === INITIAL_SLUG);
  if (!initial) add('fail', 'gate', `Scheduled LinkedIn post must be ${INITIAL_SLUG}`);
  else {
    if (!initial.articlePublishAt) add('fail', 'gate', `${INITIAL_SLUG} missing articlePublishAt`);
    if (!initial.bufferTransferAt) add('fail', 'gate', `${INITIAL_SLUG} missing bufferTransferAt`);
    if (!initial.linkedinPublishAt) add('fail', 'gate', `${INITIAL_SLUG} missing linkedinPublishAt`);
    if (initial.articlePublishAt && initial.bufferTransferAt) {
      const gap =
        new Date(initial.bufferTransferAt).getTime() - new Date(initial.articlePublishAt).getTime();
      if (gap < 25 * 60_000) add('fail', 'gate', 'Buffer must be at least 25min after Web publish');
    }
  }

  for (const p of hold) {
    if (p.articlePublishAt) add('fail', 'gate', `editorial_hold ${p.slug} must not have articlePublishAt`);
    if (p.bufferTransferAt) add('fail', 'gate', `editorial_hold ${p.slug} must not have bufferTransferAt`);
    if (p.linkedinPublishAt) add('fail', 'gate', `editorial_hold ${p.slug} must not have linkedinPublishAt`);
    if (isBufferEligible(p)) add('fail', 'gate', `editorial_hold ${p.slug} must not be buffer-eligible`);
  }

  if (initial?.bufferTransferAt) {
    const gateDay = toJstDateString(new Date(initial.bufferTransferAt));
    const bufferCandidates = queue.posts.filter((p) => {
      if (p.status === EDITORIAL_STATUSES.HOLD || !p.bufferTransferAt) return false;
      return toJstDateString(new Date(p.bufferTransferAt)) === gateDay && isBufferEligible(p);
    });
    if (bufferCandidates.length !== 1 || bufferCandidates[0].slug !== INITIAL_SLUG) {
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
  const holdSlugs = schedule.articles.filter((a) => a.status === EDITORIAL_STATUSES.HOLD).map((a) => a.slug);
  const html = fs.readFileSync(PATHS.insightsIndex, 'utf8');

  for (const slug of holdSlugs) {
    if (html.includes(`data-scheduled-slug="${slug}"`)) {
      add('fail', 'gate', `index.html shows editorial_hold article as planned: ${slug}`);
    }
  }

  if (!html.includes(`data-scheduled-slug="${INITIAL_SLUG}"`)) {
    add('fail', 'gate', `index.html must show planned card for ${INITIAL_SLUG}`);
  }

  const plannedCount = (html.match(/class="insight-card planned"/g) || []).length;
  if (plannedCount !== 1) add('fail', 'gate', `Expected 1 planned card in index.html, found ${plannedCount}`);
}

function validateBufferDispatcher() {
  if (!isBufferConfigured()) add('review', 'buffer', 'BUFFER credentials not configured (expected for local)');
  add('pass', 'buffer', 'queue-daily-linkedin-buffer.mjs exists');
}

function main() {
  try {
    validateArticles();
    validateHtml();
    validateSchedule();
    validateQueue();
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
