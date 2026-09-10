/**
 * Detect weekday publish slots with no scheduled article and recover by pull-forward.
 */
import fs from 'node:fs';
import { PATHS } from './insights-v2-paths.mjs';
import { toJstDateString, isWeekday, nextPublishDayAfterUnlock } from './business-days.mjs';
import {
  findEarliestScheduledArticle,
  findPublishedOnDate,
  findScheduledOnDate,
} from './unlock-next-insight.mjs';
import { EDITORIAL_STATUSES } from './editorial-status.mjs';

export function findLatestScheduledArticle(schedule) {
  return (
    schedule.articles
      .filter((a) => a.status === EDITORIAL_STATUSES.SCHEDULED && a.publishAt)
      .sort((a, b) => new Date(b.publishAt).getTime() - new Date(a.publishAt).getTime())[0] || null
  );
}
import { rescheduleArticlePublishDay } from './reschedule-publish-day.mjs';

export function listWeekdayGaps(schedule, { startYmd, endYmd } = {}) {
  const gaps = [];
  let ymd = startYmd;
  while (ymd <= endYmd) {
    if (isWeekday(new Date(`${ymd}T12:00:00+09:00`))) {
      const scheduled = findScheduledOnDate(schedule, ymd);
      const published = findPublishedOnDate(schedule, ymd);
      if (!scheduled && !published) gaps.push(ymd);
    }
    ymd = nextPublishDayAfterUnlock(ymd);
  }
  return gaps;
}

export function findGapScanWindow(schedule, now = new Date()) {
  const todayYmd = toJstDateString(now);
  const earliest = findEarliestScheduledArticle(schedule);
  const latest = findLatestScheduledArticle(schedule);
  const startYmd = nextPublishDayAfterUnlock(todayYmd);
  const endYmd = latest?.publishAt?.slice(0, 10) || earliest?.publishAt?.slice(0, 10) || startYmd;
  return { startYmd, endYmd, earliest, latest };
}

/**
 * Pull the earliest future scheduled article onto the first gap day.
 */
export function recoverPublishDayGap({
  schedule,
  now = new Date(),
  maxPullForwardDays = 14,
  dryRun = false,
} = {}) {
  const { startYmd, endYmd } = findGapScanWindow(schedule, now);
  const gaps = listWeekdayGaps(schedule, { startYmd, endYmd });
  if (!gaps.length) return { recovered: false, reason: 'no_gap', startYmd, endYmd };

  const gapYmd = gaps[0];
  const candidate = schedule.articles
    .filter((a) => a.status === EDITORIAL_STATUSES.SCHEDULED && a.publishAt)
    .filter((a) => a.publishAt.slice(0, 10) > gapYmd)
    .sort((a, b) => new Date(a.publishAt).getTime() - new Date(b.publishAt).getTime())[0];
  if (!candidate?.publishAt) {
    return { recovered: false, reason: 'no_scheduled_candidate', gaps, startYmd, endYmd, gapYmd };
  }

  const fromYmd = candidate.publishAt.slice(0, 10);
  const pullDays = Math.round(
    (new Date(`${fromYmd}T00:00:00+09:00`).getTime() - new Date(`${gapYmd}T00:00:00+09:00`).getTime()) /
    (24 * 60 * 60 * 1000),
  );
  if (pullDays <= 0 || pullDays > maxPullForwardDays) {
    return {
      recovered: false,
      reason: 'candidate_out_of_window',
      gaps,
      earliest: candidate.slug,
      earliestYmd: fromYmd,
      pullDays,
      startYmd,
      endYmd,
      gapYmd,
    };
  }

  if (dryRun) {
    return { recovered: true, dryRun: true, slug: candidate.slug, fromYmd, toYmd: gapYmd, gaps, startYmd, endYmd };
  }

  const result = rescheduleArticlePublishDay({ slug: candidate.slug, publishYmd: gapYmd, dryRun: false });
  return { recovered: true, ...result, fromYmd, toYmd: gapYmd, gaps, startYmd, endYmd };
}

/**
 * Fill every weekday gap before the earliest scheduled article by pull-forward.
 */
export function recoverAllPublishDayGaps({
  now = new Date(),
  maxPullForwardDays = 14,
  dryRun = false,
  maxIterations = 10,
} = {}) {
  const recoveries = [];
  for (let i = 0; i < maxIterations; i += 1) {
    const schedule = JSON.parse(fs.readFileSync(PATHS.schedule, 'utf8'));
    const recovery = recoverPublishDayGap({ schedule, now, maxPullForwardDays, dryRun });
    if (!recovery.recovered) {
      return { recovered: recoveries.length > 0, recoveries, last: recovery };
    }
    recoveries.push(recovery);
    if (dryRun) break;
  }
  return { recovered: recoveries.length > 0, recoveries };
}
