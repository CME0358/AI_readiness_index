/**
 * Unlock the next editorial_hold v2 article for publication (day-before 15:00 JST gate).
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, articleUrl } from './insights-v2-paths.mjs';
import { EDITORIAL_STATUSES } from './editorial-status.mjs';
import {
  CHANNEL_KEYS,
  CHANNEL_ENV,
  CHANNEL_CONTENT_DIRS,
  CHANNEL_STATUSES,
} from './social-channels.mjs';
import {
  toJstDateString,
  nextPublishDayAfterUnlock,
  articleTimesForPublishDay,
} from './business-days.mjs';

export const UNLOCK_TIME_JST = '15:00';

export function findNextHoldArticle(schedule) {
  return schedule.articles.find(
    (a) => a.series === 'v2' && a.status === EDITORIAL_STATUSES.HOLD
  );
}

export function findScheduledArticle(schedule) {
  return schedule.articles.find(
    (a) => a.series === 'v2' && a.status === EDITORIAL_STATUSES.SCHEDULED
  );
}

export function resolvePublishYmd({ now = new Date(), publishDate = null } = {}) {
  if (publishDate) return publishDate;
  return nextPublishDayAfterUnlock(toJstDateString(now));
}

export function buildChannelEntries(slug, times) {
  const channels = {};
  const map = { linkedin: times.linkedin, facebook: times.facebook, x: times.x };
  for (const ch of CHANNEL_KEYS) {
    channels[ch] = {
      channelIdEnv: CHANNEL_ENV[ch],
      contentFile: `${CHANNEL_CONTENT_DIRS[ch]}/${slug}.md`,
      publishAt: map[ch],
      status: CHANNEL_STATUSES.SCHEDULED,
      bufferUpdateId: null,
      attempts: 0,
      lastAttemptAt: null,
      lastError: null,
      updatedAt: new Date().toISOString(),
    };
  }
  return channels;
}

export function upsertPlannedCard(html, article) {
  let out = html.replace(/\s*<article class="insight-card planned"[\s\S]*?<\/article>\s*/g, '');
  const ymd = article.publishAt.slice(0, 10);
  const dot = ymd.replace(/-/g, '.');
  const card = `      <article class="insight-card planned" data-scheduled-slug="${article.slug}">
        <div class="insight-meta">
          <time datetime="${ymd}">${dot} 10:00</time>
          <span class="insight-tag soon">公開予定</span>
        </div>
        <h3>${article.title}</h3>
        <p>${article.cardSummary || ''}</p>
      </article>
`;
  return out.replace('<!-- INSIGHTS_CARDS_START -->', `<!-- INSIGHTS_CARDS_START -->\n${card}`);
}

/**
 * @returns {{ updated: boolean, slug: string|null, publishYmd: string|null, reason?: string }}
 */
export function unlockNextInsight({
  now = new Date(),
  publishDate = null,
  dryRun = false,
} = {}) {
  const schedule = JSON.parse(fs.readFileSync(PATHS.schedule, 'utf8'));
  const publishYmd = resolvePublishYmd({ now, publishDate });
  const times = articleTimesForPublishDay(publishYmd);

  const existing = findScheduledArticle(schedule);
  if (existing) {
    const existingYmd = existing.publishAt?.slice(0, 10);
    if (existingYmd === publishYmd) {
      return { updated: false, slug: existing.slug, publishYmd, reason: 'already_scheduled' };
    }
    return {
      updated: false,
      slug: existing.slug,
      publishYmd,
      reason: `another_article_scheduled:${existing.slug}:${existingYmd}`,
    };
  }

  const next = findNextHoldArticle(schedule);
  if (!next) {
    return { updated: false, slug: null, publishYmd, reason: 'no_editorial_hold' };
  }

  if (dryRun) {
    return { updated: false, slug: next.slug, publishYmd, reason: 'dry_run' };
  }

  const unlockedAt = now.toISOString();
  next.status = EDITORIAL_STATUSES.SCHEDULED;
  next.publishAt = times.web;
  next.unlockedAt = unlockedAt;

  const linkedinQueue = JSON.parse(fs.readFileSync(PATHS.linkedinQueue, 'utf8'));
  const liPost = linkedinQueue.posts.find((p) => p.slug === next.slug);
  if (liPost) {
    liPost.status = EDITORIAL_STATUSES.SCHEDULED;
    liPost.articlePublishAt = times.web;
    liPost.bufferTransferAt = times.bufferTransfer;
    liPost.linkedinPublishAt = times.linkedin;
    liPost.articleUrl = articleUrl(next.slug);
    liPost.bufferUpdateId = null;
    liPost.attempts = 0;
    liPost.lastError = null;
    liPost.updatedAt = unlockedAt;
  }

  let bufferQueue = null;
  if (fs.existsSync(PATHS.bufferQueue)) {
    bufferQueue = JSON.parse(fs.readFileSync(PATHS.bufferQueue, 'utf8'));
    const bufPost = bufferQueue.posts.find((p) => p.slug === next.slug);
    if (bufPost) {
      bufPost.status = EDITORIAL_STATUSES.SCHEDULED;
      bufPost.articlePublishAt = times.web;
      bufPost.bufferTransferAt = times.bufferTransfer;
      bufPost.articleUrl = articleUrl(next.slug);
      bufPost.unlockedAt = unlockedAt;
      bufPost.channels = buildChannelEntries(next.slug, times);
      bufPost.updatedAt = unlockedAt;
    }
  }

  let html = fs.readFileSync(PATHS.insightsIndex, 'utf8');
  html = upsertPlannedCard(html, next);

  fs.writeFileSync(PATHS.schedule, JSON.stringify(schedule, null, 2) + '\n', 'utf8');
  fs.writeFileSync(PATHS.linkedinQueue, JSON.stringify(linkedinQueue, null, 2) + '\n', 'utf8');
  if (bufferQueue) {
    fs.writeFileSync(PATHS.bufferQueue, JSON.stringify(bufferQueue, null, 2) + '\n', 'utf8');
  }
  fs.writeFileSync(PATHS.insightsIndex, html, 'utf8');

  fs.mkdirSync(PATHS.reportsDir, { recursive: true });
  fs.writeFileSync(
    path.join(PATHS.reportsDir, 'unlock-next-insight.json'),
    JSON.stringify({ unlockedAt, slug: next.slug, publishYmd, times, unlockDay: toJstDateString(now) }, null, 2) + '\n',
    'utf8'
  );

  return { updated: true, slug: next.slug, publishYmd, times };
}
