/**
 * Detect weekday publish slots with no scheduled article and recover by pull-forward.
 */
import { EDITORIAL_STATUSES } from './editorial-status.mjs';
import { toJstDateString, isWeekday, nextPublishDayAfterUnlock } from './business-days.mjs';
import { findEarliestScheduledArticle, findPublishedOnDate, findScheduledOnDate } from './unlock-next-insight.mjs';
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

/**
 * Pull the earliest future scheduled article onto the first gap day.
 */
export function recoverPublishDayGap({
  schedule,
  now = new Date(),
  maxPullForwardDays = 14,
  dryRun = false,
} = {}) {
  const todayYmd = toJstDateString(now);
  const endYmd = nextPublishDayAfterUnlock(todayYmd);
  const gaps = listWeekdayGaps(schedule, { startYmd: todayYmd, endYmd });
  if (!gaps.length) return { recovered: false, reason: 'no_gap' };

  const earliest = findEarliestScheduledArticle(schedule);
  if (!earliest?.publishAt) return { recovered: false, reason: 'no_scheduled_candidate', gaps };

  const earliestYmd = earliest.publishAt.slice(0, 10);
  const gapYmd = gaps[0];
  const pullDays = Math.round(
    (new Date(`${earliestYmd}T00:00:00+09:00`).getTime() - new Date(`${gapYmd}T00:00:00+09:00`).getTime()) /
    (24 * 60 * 60 * 1000),
  );
  if (pullDays <= 0 || pullDays > maxPullForwardDays) {
    return { recovered: false, reason: 'candidate_out_of_window', gaps, earliest: earliest.slug, earliestYmd, pullDays };
  }

  if (dryRun) {
    return { recovered: true, dryRun: true, slug: earliest.slug, fromYmd: earliestYmd, toYmd: gapYmd, gaps };
  }

  const result = rescheduleArticlePublishDay({ slug: earliest.slug, publishYmd: gapYmd, dryRun: false });
  return { recovered: true, ...result, fromYmd: earliestYmd, toYmd: gapYmd, gaps };
}
