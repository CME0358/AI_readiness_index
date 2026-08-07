#!/usr/bin/env node
/**
 * Agent Readiness Insights v2 orchestrator.
 * Materializes MD, LinkedIn, HTML, schedule, queue, calendar from editorial assets.
 *
 * Usage: node scripts/generate-insights-v2.mjs [--skip-html] [--skip-schedule]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { PATHS, ROOT, articleUrl } from './lib/insights-v2-paths.mjs';
import { getScheduledSeoPackage } from './lib/insights-seo-package.mjs';
import { isoAtJst, toJstDateString, charCountNoSpace } from './lib/business-days.mjs';

const skipHtml = process.argv.includes('--skip-html');
const skipSchedule = process.argv.includes('--skip-schedule');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function materializeMarkdown(articles) {
  const meta = {};
  for (const a of articles) {
    const mdPath = path.join(PATHS.columnDir, `${a.slug}.md`);
    fs.writeFileSync(mdPath, a.body.trim() + '\n', 'utf8');
    const seo = getScheduledSeoPackage(a.slug);
    meta[a.slug] = {
      title: a.title,
      seoTitle: seo?.h1,
      lead: seo?.lead ?? a.lead,
      desc: seo?.meta ?? a.desc,
      metaDescription: seo?.meta,
      searchIntentClass: seo?.intent,
      primarySearchIntent: seo?.primarySearchIntent,
      crumb: seo?.breadcrumb ?? a.crumb,
      cardSummary: a.cardSummary,
      ctaExtra: a.ctaExtra || '',
      mdFile: `${a.slug}.md`,
    };
    const liPath = path.join(PATHS.linkedinDir, `${a.slug}.md`);
    fs.writeFileSync(liPath, a.linkedin.trim() + '\n', 'utf8');
  }
  writeJson(PATHS.articleMeta, { version: '2.0', updatedAt: new Date().toISOString(), articles: meta });
  console.log('Wrote', articles.length, 'markdown + linkedin files');
}

function generateHtml(articles, plan) {
  for (const a of articles) {
    const planEntry = plan.articles.find((p) => p.slug === a.slug);
    const date = planEntry?.articlePublishAt?.slice(0, 10) || '2026-08-04';
    const mdPath = path.join(PATHS.columnDir, `${a.slug}.md`);
    const outDir = path.join(PATHS.scheduledDir, a.slug);
    ensureDir(outDir);
    const args = [
      'node',
      'scripts/generate-insight-article.mjs',
      '--md',
      mdPath,
      '--slug',
      a.slug,
      '--date',
      date,
      '--out',
      outDir,
      '--title',
      a.title,
      '--lead',
      a.lead,
      '--desc',
      a.desc,
      '--crumb',
      a.crumb,
    ];
    if (a.ctaExtra) args.push('--cta-extra', a.ctaExtra);
    execSync(args.map((x) => `"${x.replace(/"/g, '\\"')}"`).join(' '), {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
    });
  }
  console.log('Generated HTML for', articles.length, 'articles');
}

function appendSchedule(plan) {
  const schedule = readJson(PATHS.schedule);
  const existingSlugs = new Set(schedule.articles.map((x) => x.slug));
  let added = 0;
  for (const a of plan.articles) {
    if (existingSlugs.has(a.slug)) continue;
    const art = readJson(PATHS.articleMeta).articles[a.slug];
    schedule.articles.push({
      slug: a.slug,
      publishAt: a.articlePublishAt,
      status: 'scheduled',
      title: a.title,
      cardSummary: art?.cardSummary || a.mainConclusion,
      llmsLabel: a.title.slice(0, 40),
      series: 'v2',
    });
    added++;
  }
  writeJson(PATHS.schedule, schedule);
  console.log('Added', added, 'entries to schedule.json');
}

function buildLinkedInQueue(plan) {
  const now = new Date().toISOString();
  const posts = plan.articles.map((a, i) => {
    const articleYmd = a.articlePublishAt.slice(0, 10);
    const bufferTransferAt = isoAtJst(articleYmd, '10:30');
    return {
      id: `ARI-LI-${String(i + 1).padStart(3, '0')}`,
      slug: a.slug,
      articlePublishAt: a.articlePublishAt,
      bufferTransferAt,
      linkedinPublishAt: a.linkedinPublishAt,
      articleUrl: articleUrl(a.slug),
      contentFile: `insights/_social/linkedin/posts/${a.slug}.md`,
      status: 'scheduled',
      bufferUpdateId: null,
      attempts: 0,
      lastAttemptAt: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };
  });

  const queue = {
    timezone: 'Asia/Tokyo',
    policy: {
      provider: 'buffer',
      transferMode: 'daily',
      postsPerTransfer: 1,
      weekdaysOnly: true,
      articlePublishTime: '10:00',
      bufferTransferTime: '10:30',
      linkedinPublishTime: '11:30',
    },
    posts,
  };
  writeJson(PATHS.linkedinQueue, queue);
  console.log('Built LinkedIn queue with', posts.length, 'posts');
}

function buildCalendar(plan) {
  const rows = [['order', 'slug', 'title', 'category', 'article_publish_date', 'article_publish_time', 'linkedin_transfer_time', 'linkedin_publish_time', 'article_status', 'linkedin_status', 'article_url']];
  for (const a of plan.articles) {
    rows.push([
      a.order,
      a.slug,
      `"${a.title.replace(/"/g, '""')}"`,
      a.category,
      a.articlePublishAt.slice(0, 10),
      '10:00',
      '10:15',
      '11:00',
      'scheduled',
      'scheduled',
      articleUrl(a.slug),
    ]);
  }
  const csv = rows.map((r) => r.join(',')).join('\n') + '\n';
  fs.writeFileSync(PATHS.publicationCalendarCsv, csv, 'utf8');

  const md = ['# Publication Calendar v2\n', '| order | slug | title | Web | LinkedIn | URL |', '| --- | --- | --- | --- | --- | --- |'];
  for (const a of plan.articles) {
    md.push(`| ${a.order} | ${a.slug} | ${a.title} | ${a.articlePublishAt.slice(0, 10)} 10:00 | ${a.linkedinPublishAt.slice(0, 10)} 11:00 | ${articleUrl(a.slug)} |`);
  }
  fs.writeFileSync(PATHS.publicationCalendarMd, md.join('\n') + '\n', 'utf8');
}

function appendPlannedCards(plan) {
  let html = fs.readFileSync(PATHS.insightsIndex, 'utf8');
  for (const a of plan.articles) {
    if (html.includes(`data-scheduled-slug="${a.slug}"`)) continue;
    const art = readJson(PATHS.articleMeta).articles[a.slug];
    const ymd = a.articlePublishAt.slice(0, 10);
    const dot = ymd.replace(/-/g, '.');
    const card = `      <article class="insight-card planned" data-scheduled-slug="${a.slug}">
        <div class="insight-meta">
          <time datetime="${ymd}">${dot} 10:00</time>
          <span class="insight-tag soon">公開予定</span>
        </div>
        <h3>${a.title}</h3>
        <p>${art?.cardSummary || a.mainConclusion}</p>
      </article>
`;
    html = html.replace('    </div>\n    <div class="cta-row reveal">', card + '    </div>\n    <div class="cta-row reveal">');
  }
  fs.writeFileSync(PATHS.insightsIndex, html, 'utf8');
  console.log('Appended planned cards to insights/index.html');
}

function main() {
  const content = readJson(PATHS.articlesContent);
  const plan = readJson(PATHS.editorialPlan);
  const articles = content.articles;

  for (const a of articles) {
    const n = charCountNoSpace(a.body);
    if (n < 2000 || n > 2700) console.warn(`WARN char count ${a.slug}: ${n}`);
  }

  materializeMarkdown(articles);
  if (!skipHtml) generateHtml(articles, plan);
  if (!skipSchedule) appendSchedule(plan);
  buildLinkedInQueue(plan);
  buildCalendar(plan);
  appendPlannedCards(plan);
  console.log('generate-insights-v2 complete');
}

main();
