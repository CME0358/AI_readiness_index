#!/usr/bin/env node
/**
 * Apply same-day initial publication schedule for ai-search-shift.
 * Bumps times if current JST is too close (45min rule, 15min rounding).
 *
 * Usage:
 *   node scripts/apply-same-day-publication.mjs
 *   node scripts/apply-same-day-publication.mjs --web 11:00 --buffer 11:30 --linkedin 12:00
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { PATHS, ROOT } from './lib/insights-v2-paths.mjs';
import { EDITORIAL_STATUSES, INITIAL_SLUG } from './lib/editorial-status.mjs';

const TZ = 'Asia/Tokyo';

function parseArg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function nowJst() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
}

function ymdJst(d = nowJst()) {
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

function roundUp15(totalMinutes) {
  return Math.ceil(totalMinutes / 15) * 15;
}

function addMinutesJst(base, minutes) {
  const d = new Date(base.getTime() + minutes * 60_000);
  const ymd = d.toLocaleDateString('en-CA', { timeZone: TZ });
  const hm = d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  return { ymd, hm, iso: `${ymd}T${hm}:00+09:00` };
}

function hmToIso(ymd, hm) {
  return `${ymd}T${hm}:00+09:00`;
}

function computeSchedule() {
  const requestedWeb = parseArg('--web') || '11:00';
  const requestedBuffer = parseArg('--buffer') || '11:30';
  const requestedLinkedin = parseArg('--linkedin') || '12:00';
  const today = ymdJst();
  const now = nowJst();

  let webHm = requestedWeb;
  let bufferHm = requestedBuffer;
  let linkedinHm = requestedLinkedin;

  const webDate = new Date(`${today}T${webHm}:00+09:00`);
  const minWeb = addMinutesJst(now, roundUp15(45));
  const minWebDate = new Date(minWeb.iso);

  if (webDate.getTime() < minWebDate.getTime()) {
    webHm = minWeb.hm;
    const buf = addMinutesJst(new Date(minWeb.iso), 30);
    bufferHm = buf.hm;
    const li = addMinutesJst(new Date(buf.iso), 30);
    linkedinHm = li.hm;
  }

  return {
    today,
    web: hmToIso(today, webHm),
    buffer: hmToIso(today, bufferHm),
    linkedin: hmToIso(today, linkedinHm),
    webHm,
    bufferHm,
    linkedinHm,
    bumped: webHm !== requestedWeb,
  };
}

function main() {
  const times = computeSchedule();

  const schedule = JSON.parse(fs.readFileSync(PATHS.schedule, 'utf8'));
  for (const a of schedule.articles) {
    if (a.slug !== INITIAL_SLUG || a.series !== 'v2') continue;
    a.status = EDITORIAL_STATUSES.SCHEDULED;
    a.publishAt = times.web;
  }
  fs.writeFileSync(PATHS.schedule, JSON.stringify(schedule, null, 2) + '\n', 'utf8');

  const queue = JSON.parse(fs.readFileSync(PATHS.linkedinQueue, 'utf8'));
  for (const p of queue.posts) {
    if (p.slug !== INITIAL_SLUG) continue;
    p.status = EDITORIAL_STATUSES.SCHEDULED;
    p.articlePublishAt = times.web;
    p.bufferTransferAt = times.buffer;
    p.linkedinPublishAt = times.linkedin;
  }
  fs.writeFileSync(PATHS.linkedinQueue, JSON.stringify(queue, null, 2) + '\n', 'utf8');

  const plan = JSON.parse(fs.readFileSync(PATHS.editorialPlan, 'utf8'));
  for (const a of plan.articles) {
    if (a.slug === INITIAL_SLUG) {
      a.articlePublishAt = times.web;
      a.linkedinPublishAt = times.linkedin;
      a.sameDayOverride = true;
    }
  }
  fs.writeFileSync(PATHS.editorialPlan, JSON.stringify(plan, null, 2) + '\n', 'utf8');

  const rows = [['order', 'slug', 'title', 'category', 'article_publish_date', 'article_publish_time', 'linkedin_transfer_time', 'linkedin_publish_time', 'article_status', 'linkedin_status', 'article_url']];
  for (const a of plan.articles) {
    const isInitial = a.slug === INITIAL_SLUG;
    rows.push([
      a.order,
      a.slug,
      `"${a.title.replace(/"/g, '""')}"`,
      a.category,
      isInitial ? times.today : '',
      isInitial ? times.webHm : '',
      isInitial ? times.bufferHm : '',
      isInitial ? times.linkedinHm : '',
      isInitial ? 'scheduled' : 'editorial_hold',
      isInitial ? 'scheduled' : 'editorial_hold',
      `https://readiness.coaretail.com/insights/${a.slug}/`,
    ]);
  }
  fs.writeFileSync(PATHS.publicationCalendarCsv, rows.map((r) => r.join(',')).join('\n') + '\n', 'utf8');

  const md = [
    '# Publication Calendar v2',
    '',
    `**Same-day override:** \`${INITIAL_SLUG}\` on ${times.today} (Web ${times.webHm} / Buffer ${times.bufferHm} / LinkedIn ${times.linkedinHm} JST).`,
    '',
    'Tomorrow onward: Web 10:00 / Buffer 10:30 / LinkedIn 11:30 JST (weekdays).',
    '',
    '| order | slug | title | Web | Buffer | LinkedIn | status |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const a of plan.articles) {
    const isInitial = a.slug === INITIAL_SLUG;
    md.push(
      `| ${a.order} | ${a.slug} | ${a.title} | ${isInitial ? `${times.today} ${times.webHm}` : '—'} | ${isInitial ? times.bufferHm : '—'} | ${isInitial ? times.linkedinHm : '—'} | ${isInitial ? 'scheduled' : 'editorial_hold'} |`
    );
  }
  fs.writeFileSync(PATHS.publicationCalendarMd, md.join('\n') + '\n', 'utf8');

  let html = fs.readFileSync(PATHS.insightsIndex, 'utf8');
  html = html.replace(
    new RegExp(`(<article class="insight-card planned" data-scheduled-slug="${INITIAL_SLUG}">[\\s\\S]*?<time datetime=")[^"]+("[^>]*>)[^<]+(<)`),
    `$1${times.today}$2${times.today.replace(/-/g, '.')} ${times.webHm}$3`
  );
  fs.writeFileSync(PATHS.insightsIndex, html, 'utf8');

  execSync(
    [
      'node scripts/generate-insight-article.mjs',
      '--md crucial_data/column/ai-search-shift.md',
      `--slug ${INITIAL_SLUG}`,
      `--date ${times.today}`,
      `--out insights/_scheduled/${INITIAL_SLUG}`,
      '--title "AI検索が変える「比較」の意味"',
      '--lead "検索結果の一覧を眺める行為から、AIが候補を組み立てて説明する行為へ。比較の主語が移ると、企業に求められる情報設計も変わる。"',
      '--desc "AI検索では比較の主語がユーザーからエージェントへ移る。順位ではなく候補形成・根拠提示・実行可能性を整える視点を、Agent Readinessの三層で整理する。"',
      '--crumb "AI検索と比較の変化"',
      '--cta-extra "/framework/|Frameworkを見る"',
    ].join(' '),
    { cwd: ROOT, stdio: 'inherit', shell: true }
  );

  fs.mkdirSync(PATHS.reportsDir, { recursive: true });
  fs.writeFileSync(
    `${PATHS.reportsDir}/same-day-schedule.json`,
    JSON.stringify({ appliedAt: new Date().toISOString(), ...times }, null, 2) + '\n',
    'utf8'
  );

  console.log(JSON.stringify(times, null, 2));
}

main();
