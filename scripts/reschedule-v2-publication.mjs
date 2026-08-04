#!/usr/bin/env node
/**
 * Reschedule v2 articles from a safe future business-day start.
 * Updates editorial-plan, schedule.json (v2 only), queue.json, calendars.
 *
 * Usage:
 *   node scripts/reschedule-v2-publication.mjs --start 2026-08-05
 *   node scripts/reschedule-v2-publication.mjs --start 2026-08-05 --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, articleUrl } from './lib/insights-v2-paths.mjs';
import { businessDaysFrom, isoAtJst } from './lib/business-days.mjs';

const dryRun = process.argv.includes('--dry-run');
const startIdx = process.argv.indexOf('--start');
const startYmd = startIdx >= 0 ? process.argv[startIdx + 1] : null;
if (!startYmd || !/^\d{4}-\d{2}-\d{2}$/.test(startYmd)) {
  console.error('Usage: --start YYYY-MM-DD');
  process.exit(1);
}

const BUFFER_TIME = '10:30';
const LINKEDIN_TIME = '11:30';

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  if (dryRun) return;
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const plan = readJson(PATHS.editorialPlan);
const schedule = readJson(PATHS.schedule);
const queue = readJson(PATHS.linkedinQueue);
const days = businessDaysFrom(startYmd, plan.articles.length);

if (days.length !== plan.articles.length) {
  console.error('Business day count mismatch');
  process.exit(1);
}

const before = plan.articles.map((a) => ({
  slug: a.slug,
  articlePublishAt: a.articlePublishAt,
  linkedinPublishAt: a.linkedinPublishAt,
}));

plan.startDate = startYmd;
plan.rescheduledAt = new Date().toISOString();

plan.articles.forEach((a, i) => {
  const ymd = days[i];
  a.articlePublishAt = isoAtJst(ymd, '10:00');
  a.linkedinPublishAt = isoAtJst(ymd, LINKEDIN_TIME);
});

for (const entry of schedule.articles.filter((a) => a.series === 'v2')) {
  const p = plan.articles.find((x) => x.slug === entry.slug);
  if (!p) continue;
  entry.publishAt = p.articlePublishAt;
  if (entry.status === 'scheduled') {
    // keep scheduled — only v2 not yet published
  }
}

for (const post of queue.posts) {
  const p = plan.articles.find((x) => x.slug === post.slug);
  if (!p) continue;
  post.articlePublishAt = p.articlePublishAt;
  post.bufferTransferAt = isoAtJst(p.articlePublishAt.slice(0, 10), BUFFER_TIME);
  post.linkedinPublishAt = p.linkedinPublishAt;
  post.articleUrl = articleUrl(p.slug);
  if (!post.bufferUpdateId) {
    post.status = 'scheduled';
    post.attempts = 0;
    post.lastError = null;
  }
}

queue.policy.bufferTransferTime = BUFFER_TIME;
queue.policy.linkedinPublishTime = LINKEDIN_TIME;

// Update planned cards in index.html
let html = fs.readFileSync(PATHS.insightsIndex, 'utf8');
for (const a of plan.articles) {
  const ymd = a.articlePublishAt.slice(0, 10);
  const dot = ymd.replace(/-/g, '.');
  const re = new RegExp(
    `(data-scheduled-slug="${a.slug}"[\\s\\S]*?<time datetime=")[^"]+("[^>]*>)[^<]+(<)`,
    'm'
  );
  html = html.replace(re, `$1${ymd}$2${dot} 10:00$3`);
}

const rows = [['order', 'slug', 'title', 'category', 'article_publish_date', 'article_publish_time', 'linkedin_transfer_time', 'linkedin_publish_time', 'article_status', 'linkedin_status', 'article_url']];
for (const a of plan.articles) {
  rows.push([
    a.order,
    a.slug,
    `"${a.title.replace(/"/g, '""')}"`,
    a.category,
    a.articlePublishAt.slice(0, 10),
    '10:00',
    BUFFER_TIME,
    LINKEDIN_TIME,
    'scheduled',
    'scheduled',
    articleUrl(a.slug),
  ]);
}
const csv = rows.map((r) => r.join(',')).join('\n') + '\n';
const md = ['# Publication Calendar v2\n', '| order | slug | title | Web | Buffer | LinkedIn | URL |', '| --- | --- | --- | --- | --- | --- | --- |'];
for (const a of plan.articles) {
  md.push(`| ${a.order} | ${a.slug} | ${a.title} | ${a.articlePublishAt.slice(0, 10)} 10:00 | ${a.articlePublishAt.slice(0, 10)} ${BUFFER_TIME} | ${a.linkedinPublishAt.slice(0, 10)} ${LINKEDIN_TIME} | ${articleUrl(a.slug)} |`);
}

if (!dryRun) {
  writeJson(PATHS.editorialPlan, plan);
  writeJson(PATHS.schedule, schedule);
  writeJson(PATHS.linkedinQueue, queue);
  fs.writeFileSync(PATHS.publicationCalendarCsv, csv, 'utf8');
  fs.writeFileSync(PATHS.publicationCalendarMd, md.join('\n') + '\n', 'utf8');
  fs.writeFileSync(PATHS.insightsIndex, html, 'utf8');
}

const after = plan.articles.map((a) => ({
  slug: a.slug,
  articlePublishAt: a.articlePublishAt,
  linkedinPublishAt: a.linkedinPublishAt,
  bufferTransferAt: isoAtJst(a.articlePublishAt.slice(0, 10), BUFFER_TIME),
}));

console.log(JSON.stringify({ startYmd, first: after[0], last: after[after.length - 1], dryRun }, null, 2));
fs.mkdirSync(PATHS.reportsDir, { recursive: true });
fs.writeFileSync(
  path.join(PATHS.reportsDir, 'v2-schedule-reschedule.json'),
  JSON.stringify({ before, after, startYmd, dryRun }, null, 2) + '\n',
  'utf8'
);
