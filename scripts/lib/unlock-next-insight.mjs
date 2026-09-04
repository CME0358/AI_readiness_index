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
  previousBusinessDay,
  nextPublishDayAfterUnlock,
  articleTimesForPublishDay,
} from './business-days.mjs';
import { prepareScheduledArticle } from './prepare-scheduled-article.mjs';
import { markHeroPending } from './insights-package-readiness.mjs';
import { isSameBufferLedgerEntry, normalizePublicationDate } from './buffer-ledger.mjs';

export const UNLOCK_TIME_JST = '15:00';
export const UNLOCK_LATENESS_WINDOW_MINUTES = 18 * 60;

function jstMinutes(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Number(parts.find((p) => p.type === 'hour').value) * 60 +
    Number(parts.find((p) => p.type === 'minute').value);
}

function isoAtJst(ymd, hm = UNLOCK_TIME_JST) {
  return `${ymd}T${hm}:00+09:00`;
}

/**
 * Resolve the canonical unlock slot represented by an actual run.
 * A run before today's 15:00 belongs to the prior weekday slot, but only
 * while it is within the bounded lateness window.
 */
export function resolveEffectiveUnlockSlot({ actualRunAt = new Date() } = {}) {
  const actual = actualRunAt instanceof Date ? actualRunAt : new Date(actualRunAt);
  if (Number.isNaN(actual.getTime())) throw new Error('Invalid actualRunAt');
  const actualYmd = toJstDateString(actual);
  const currentSlot = new Date(isoAtJst(actualYmd));
  const effectiveYmd = jstMinutes(actual) >= 15 * 60 ? actualYmd : previousBusinessDay(actualYmd);
  const effective = new Date(isoAtJst(effectiveYmd));
  const latenessMinutes = Math.round((actual.getTime() - effective.getTime()) / 60_000);
  if (latenessMinutes < 0 || latenessMinutes > UNLOCK_LATENESS_WINDOW_MINUTES) {
    return {
      ok: false,
      actualRunAt: actual.toISOString(),
      effectiveUnlockAt: effective.toISOString(),
      latenessMinutes,
      effectiveUnlockYmd: effectiveYmd,
      reason: 'UNLOCK_STALE_RUN_BLOCKED',
    };
  }
  return {
    ok: true,
    actualRunAt: actual.toISOString(),
    effectiveUnlockAt: effective.toISOString(),
    latenessMinutes,
    effectiveUnlockYmd: effectiveYmd,
    currentSlot: currentSlot.toISOString(),
  };
}

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

/** Any scheduled article (v2 or current-event) occupying a publish day. */
export function findScheduledOnDate(schedule, ymd) {
  return schedule.articles.find(
    (a) => a.status === EDITORIAL_STATUSES.SCHEDULED && a.publishAt?.slice(0, 10) === ymd
  );
}

export function findPublishedOnDate(schedule, ymd) {
  return schedule.articles.find(
    (a) => a.status === EDITORIAL_STATUSES.PUBLISHED &&
      (a.publishedAt?.slice(0, 10) === ymd || a.publishAt?.slice(0, 10) === ymd)
  );
}

/** Next weekday YMD on or after startYmd with no scheduled occupant. */
export function resolveNextAvailablePublishYmd(schedule, startYmd, maxAttempts = 14) {
  let ymd = startYmd;
  for (let i = 0; i < maxAttempts; i++) {
    if (!findScheduledOnDate(schedule, ymd)) return ymd;
    ymd = nextPublishDayAfterUnlock(ymd);
  }
  return ymd;
}

export function resolvePublishYmd({ now = new Date(), publishDate = null } = {}) {
  if (publishDate) return publishDate;
  const slot = resolveEffectiveUnlockSlot({ actualRunAt: now });
  if (!slot.ok) return null;
  return nextPublishDayAfterUnlock(slot.effectiveUnlockYmd);
}

export function planUnlock({ schedule, now = new Date(), publishDate = null } = {}) {
  const slot = publishDate
    ? { ok: true, actualRunAt: now.toISOString(), effectiveUnlockAt: null, latenessMinutes: 0, effectiveUnlockYmd: null }
    : resolveEffectiveUnlockSlot({ actualRunAt: now });
  const publishYmd = publishDate || (slot.ok ? nextPublishDayAfterUnlock(slot.effectiveUnlockYmd) : null);
  const base = { actualRunAt: slot.actualRunAt, effectiveUnlockAt: slot.effectiveUnlockAt, latenessMinutes: slot.latenessMinutes, publishYmd };
  if (!slot.ok) return { ...base, updated: false, slug: null, result: slot.reason, reason: slot.reason };
  const published = findPublishedOnDate(schedule, publishYmd);
  if (published) return { ...base, updated: false, slug: published.slug, result: 'NO_OP_ALREADY_PUBLISHED', reason: 'already_published' };
  const scheduled = findScheduledOnDate(schedule, publishYmd);
  if (scheduled) return { ...base, updated: false, slug: scheduled.slug, result: 'NO_OP_ALREADY_SCHEDULED', reason: 'already_scheduled' };
  const existing = findScheduledArticle(schedule);
  const existingYmd = existing?.publishAt?.slice(0, 10);
  if (existing && existingYmd <= publishYmd) {
    return { ...base, updated: false, slug: existing.slug, result: `ANOTHER_ARTICLE_SCHEDULED:${existing.slug}`, reason: `another_article_scheduled:${existing.slug}:${existing.publishAt?.slice(0, 10)}` };
  }
  const next = findNextHoldArticle(schedule);
  if (!next) return { ...base, updated: false, slug: null, result: 'NO_OP_NO_EDITORIAL_HOLD', reason: 'no_editorial_hold' };
  return { ...base, updated: false, slug: next.slug, result: 'READY_TO_UNLOCK', reason: 'ready_to_unlock' };
}

/** Earliest scheduled article across all series (v2, current-event, etc.). */
export function findEarliestScheduledArticle(schedule) {
  return (
    schedule.articles
      .filter((a) => a.status === EDITORIAL_STATUSES.SCHEDULED && a.publishAt)
      .sort((a, b) => new Date(a.publishAt).getTime() - new Date(b.publishAt).getTime())[0] || null
  );
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

export function buildPlannedCardHtml(article) {
  const ymd = article.publishAt.slice(0, 10);
  const dot = ymd.replace(/-/g, '.');
  const tag =
    article.series === 'current-event' || article.editorialType === 'current_event'
      ? 'Current Event'
      : '公開予定';
  return `      <article class="insight-card planned" data-scheduled-slug="${article.slug}">
        <div class="insight-meta">
          <time datetime="${ymd}">${dot} 10:00</time>
          <span class="insight-tag soon">${tag}</span>
        </div>
        <h3>${article.title}</h3>
        <p>${article.cardSummary || ''}</p>
      </article>
`;
}

/** Replace planned card with the earliest scheduled article (preserves current-event priority). */
export function upsertPlannedCard(html, article, schedule = null) {
  const display = schedule ? findEarliestScheduledArticle(schedule) || article : article;
  let out = html.replace(/\s*<article class="insight-card planned"[\s\S]*?<\/article>\s*/g, '');
  const card = buildPlannedCardHtml(display);
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
  const plan = planUnlock({ schedule, now, publishDate });
  const { publishYmd } = plan;
  if (!publishYmd) return plan;
  const times = articleTimesForPublishDay(publishYmd);

  if (plan.reason !== 'ready_to_unlock') return { ...plan, times };
  const next = schedule.articles.find((a) => a.slug === plan.slug);

  if (dryRun) {
    return { updated: false, slug: next.slug, publishYmd, reason: 'dry_run' };
  }

  const prepared = prepareScheduledArticle(next.slug, { strict: true });
  if (!prepared.ok) {
    return {
      updated: false,
      slug: next.slug,
      publishYmd,
      reason: `prepare_failed:${prepared.error}`,
      prepare: prepared,
    };
  }

  const unlockedAt = now.toISOString();
  next.status = EDITORIAL_STATUSES.SCHEDULED;
  next.publishAt = times.web;
  next.unlockedAt = unlockedAt;
  markHeroPending(next, { now });

  const linkedinQueue = JSON.parse(fs.readFileSync(PATHS.linkedinQueue, 'utf8'));
  const liPost = linkedinQueue.posts.find((p) => p.slug === next.slug && normalizePublicationDate(p) === publishYmd);
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
    const bufPost = bufferQueue.posts.find((p) => isSameBufferLedgerEntry(p, next.slug, publishYmd));
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
  html = upsertPlannedCard(html, next, schedule);

  fs.writeFileSync(PATHS.schedule, JSON.stringify(schedule, null, 2) + '\n', 'utf8');
  fs.writeFileSync(PATHS.linkedinQueue, JSON.stringify(linkedinQueue, null, 2) + '\n', 'utf8');
  if (bufferQueue) {
    fs.writeFileSync(PATHS.bufferQueue, JSON.stringify(bufferQueue, null, 2) + '\n', 'utf8');
  }
  fs.writeFileSync(PATHS.insightsIndex, html, 'utf8');

  fs.mkdirSync(PATHS.reportsDir, { recursive: true });
  fs.writeFileSync(
    path.join(PATHS.reportsDir, 'unlock-next-insight.json'),
    JSON.stringify({ unlockedAt, slug: next.slug, publishYmd, times, unlockDay: toJstDateString(now), actualRunAt: plan.actualRunAt, effectiveUnlockAt: plan.effectiveUnlockAt, latenessMinutes: plan.latenessMinutes, result: 'UNLOCKED' }, null, 2) + '\n',
    'utf8'
  );

  return { ...plan, updated: true, slug: next.slug, publishYmd, times, prepared, result: 'UNLOCKED' };
}
