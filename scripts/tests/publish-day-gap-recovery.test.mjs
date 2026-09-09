#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { listWeekdayGaps, recoverPublishDayGap } from '../lib/publish-day-gap-recovery.mjs';
import { EDITORIAL_STATUSES } from '../lib/editorial-status.mjs';

test('listWeekdayGaps detects empty weekday between published and scheduled', () => {
  const schedule = {
    articles: [
      { slug: 'a', status: EDITORIAL_STATUSES.PUBLISHED, publishAt: '2026-09-08T10:00:00+09:00' },
      { slug: 'b', status: EDITORIAL_STATUSES.SCHEDULED, publishAt: '2026-09-14T10:00:00+09:00' },
    ],
  };
  const gaps = listWeekdayGaps(schedule, { startYmd: '2026-09-09', endYmd: '2026-09-09' });
  assert.deepEqual(gaps, ['2026-09-09']);
});

test('recoverPublishDayGap pull-forwards earliest scheduled article', () => {
  const schedule = {
    articles: [
      { slug: 'published', status: EDITORIAL_STATUSES.PUBLISHED, publishAt: '2026-09-08T10:00:00+09:00' },
      {
        slug: 'future',
        status: EDITORIAL_STATUSES.SCHEDULED,
        publishAt: '2026-09-14T10:00:00+09:00',
        title: 'Future',
        cardSummary: 'summary',
        series: 'v2',
      },
    ],
  };
  const result = recoverPublishDayGap({
    schedule,
    now: new Date('2026-09-09T10:00:00+09:00'),
    dryRun: true,
  });
  assert.equal(result.recovered, true);
  assert.equal(result.slug, 'future');
  assert.equal(result.toYmd, '2026-09-09');
});
