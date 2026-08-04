#!/usr/bin/env node
/**
 * Apply Initial Production Gate: only ai-search-shift scheduled; 29 → editorial_hold.
 */
import fs from 'node:fs';
import { PATHS } from './lib/insights-v2-paths.mjs';
import { EDITORIAL_STATUSES, INITIAL_SLUG } from './lib/editorial-status.mjs';

function main() {
  const schedule = JSON.parse(fs.readFileSync(PATHS.schedule, 'utf8'));
  let holdCount = 0;
  let scheduledCount = 0;

  for (const a of schedule.articles) {
    if (a.series !== 'v2') continue;
    if (a.slug === INITIAL_SLUG) {
      a.status = EDITORIAL_STATUSES.SCHEDULED;
      a.publishAt = '2026-08-05T10:00:00+09:00';
      scheduledCount++;
    } else {
      a.status = EDITORIAL_STATUSES.HOLD;
      a.publishAt = null;
      holdCount++;
    }
  }
  fs.writeFileSync(PATHS.schedule, JSON.stringify(schedule, null, 2) + '\n', 'utf8');

  const queue = JSON.parse(fs.readFileSync(PATHS.linkedinQueue, 'utf8'));
  let liScheduled = 0;
  let liHold = 0;
  for (const p of queue.posts) {
    if (p.slug === INITIAL_SLUG) {
      p.status = EDITORIAL_STATUSES.SCHEDULED;
      p.articlePublishAt = '2026-08-05T10:00:00+09:00';
      p.bufferTransferAt = '2026-08-05T10:30:00+09:00';
      p.linkedinPublishAt = '2026-08-05T11:30:00+09:00';
      liScheduled++;
    } else {
      p.status = EDITORIAL_STATUSES.HOLD;
      p.articlePublishAt = null;
      p.bufferTransferAt = null;
      p.linkedinPublishAt = null;
      liHold++;
    }
  }
  fs.writeFileSync(PATHS.linkedinQueue, JSON.stringify(queue, null, 2) + '\n', 'utf8');

  const plan = JSON.parse(fs.readFileSync(PATHS.editorialPlan, 'utf8'));
  const rows = [['order', 'slug', 'title', 'category', 'article_publish_date', 'article_publish_time', 'linkedin_transfer_time', 'linkedin_publish_time', 'article_status', 'linkedin_status', 'article_url']];
  for (const a of plan.articles) {
    const isInitial = a.slug === INITIAL_SLUG;
    rows.push([
      a.order,
      a.slug,
      `"${a.title.replace(/"/g, '""')}"`,
      a.category,
      isInitial ? '2026-08-05' : '',
      isInitial ? '10:00' : '',
      isInitial ? '10:30' : '',
      isInitial ? '11:30' : '',
      isInitial ? 'scheduled' : 'editorial_hold',
      isInitial ? 'scheduled' : 'editorial_hold',
      `https://readiness.coaretail.com/insights/${a.slug}/`,
    ]);
  }
  fs.writeFileSync(PATHS.publicationCalendarCsv, rows.map((r) => r.join(',')).join('\n') + '\n', 'utf8');

  const md = [
    '# Publication Calendar v2',
    '',
    '**Gate:** Only `ai-search-shift` is scheduled. Remaining 29 articles are `editorial_hold`.',
    '',
    '| order | slug | title | Web | Buffer | LinkedIn | status |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const a of plan.articles) {
    const isInitial = a.slug === INITIAL_SLUG;
    md.push(
      `| ${a.order} | ${a.slug} | ${a.title} | ${isInitial ? '2026-08-05 10:00' : '—'} | ${isInitial ? '10:30' : '—'} | ${isInitial ? '11:30' : '—'} | ${isInitial ? 'scheduled' : 'editorial_hold'} |`
    );
  }
  fs.writeFileSync(PATHS.publicationCalendarMd, md.join('\n') + '\n', 'utf8');

  let html = fs.readFileSync(PATHS.insightsIndex, 'utf8');
  html = html.replace(
    /<article class="insight-card planned" data-scheduled-slug="(?!ai-search-shift)[^"]+">[\s\S]*?<\/article>\s*/g,
    ''
  );
  fs.writeFileSync(PATHS.insightsIndex, html, 'utf8');

  console.log(JSON.stringify({ scheduledCount, holdCount, liScheduled, liHold }, null, 2));
}

main();
