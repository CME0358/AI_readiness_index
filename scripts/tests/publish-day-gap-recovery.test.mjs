#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listWeekdayGaps, recoverPublishDayGap, recoverAllPublishDayGaps, findGapScanWindow } from '../lib/publish-day-gap-recovery.mjs';
import { EDITORIAL_STATUSES } from '../lib/editorial-status.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCHEDULE_PATH = path.join(ROOT, 'insights/_scheduled/schedule.json');

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

test('findGapScanWindow spans next weekday through latest scheduled article', () => {
  const schedule = {
    articles: [
      { slug: 'published', status: EDITORIAL_STATUSES.PUBLISHED, publishAt: '2026-09-10T10:00:00+09:00' },
      { slug: 'future', status: EDITORIAL_STATUSES.SCHEDULED, publishAt: '2026-09-15T10:00:00+09:00' },
    ],
  };
  const window = findGapScanWindow(schedule, new Date('2026-09-10T10:00:00+09:00'));
  assert.equal(window.startYmd, '2026-09-11');
  assert.equal(window.endYmd, '2026-09-15');
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
  assert.equal(result.toYmd, '2026-09-10');
});

test('listWeekdayGaps does not treat Sports Day 2026-10-12 as an open slot', () => {
  const gaps = listWeekdayGaps({ articles: [] }, { startYmd: '2026-10-05', endYmd: '2026-10-13' });
  assert.equal(gaps.includes('2026-10-05'), true);
  assert.equal(gaps.includes('2026-10-12'), false);
  assert.equal(gaps.includes('2026-10-13'), true);
});

test('recoverPublishDayGap does not pull the next article onto 2026-10-12', () => {
  const schedule = {
    articles: [
      { slug: 'before', status: EDITORIAL_STATUSES.SCHEDULED, publishAt: '2026-10-09T10:00:00+09:00' },
      {
        slug: 'next',
        status: EDITORIAL_STATUSES.SCHEDULED,
        publishAt: '2026-10-13T10:00:00+09:00',
        title: 'Next',
        cardSummary: 'summary',
        series: 'v2',
      },
    ],
  };
  const result = recoverPublishDayGap({
    schedule,
    now: new Date('2026-10-09T10:00:00+09:00'),
    dryRun: true,
  });
  assert.equal(result.recovered, false);
  assert.notEqual(result.toYmd, '2026-10-12');
  assert.equal(schedule.articles.find((article) => article.slug === 'next').publishAt, '2026-10-13T10:00:00+09:00');
});

test('schedule.json has no scheduled entry on 2026-10-12', () => {
  const schedule = JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
  const landed = schedule.articles.filter((article) => {
    const dates = [article.slotDate, article.publishAt, article.scheduledPublishAt]
      .filter(Boolean)
      .map((value) => String(value).slice(0, 10));
    return article.status === EDITORIAL_STATUSES.SCHEDULED && dates.includes('2026-10-12');
  });
  assert.deepEqual(landed.map((article) => article.slug), []);

  const bySlug = Object.fromEntries(schedule.articles.map((article) => [article.slug, article]));
  assert.equal(bySlug['bing-edge-ai-mode-naming'].publishAt, '2026-10-13T10:00:00+09:00');
  assert.equal(bySlug['bing-edge-ai-mode-naming'].slotDate, '2026-10-13');
  assert.equal(bySlug['bing-edge-ai-mode-naming'].scheduledPublishAt, '2026-10-13T10:00:00+09:00');
  assert.equal(bySlug['ai-contribution-pilot-economics'].publishAt, '2026-10-14T10:00:00+09:00');
  assert.equal(bySlug['ai-contribution-pilot-economics'].slotDate, '2026-10-14');
  assert.equal(bySlug['ai-contribution-pilot-economics'].scheduledPublishAt, '2026-10-14T10:00:00+09:00');
  assert.equal(bySlug['aio-citation-cards-and-loading'].publishAt, '2026-10-15T10:00:00+09:00');
  assert.equal(bySlug['aio-citation-cards-and-loading'].slotDate, '2026-10-15');
  assert.equal(bySlug['aio-citation-cards-and-loading'].scheduledPublishAt, '2026-10-15T10:00:00+09:00');
  assert.equal(bySlug['ai-mode-information-monitoring'].slotDate, '2026-10-08');
  assert.equal(bySlug['branded-queries-ai-overviews'].slotDate, '2026-10-09');
});

test('2026-10-02 reconcile window does not fill Sports Day', () => {
  const schedule = JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
  const now = new Date('2026-10-02T01:00:00.000Z');
  const gaps = listWeekdayGaps(schedule, findGapScanWindow(schedule, now));
  assert.equal(gaps.includes('2026-10-12'), false);
  const result = recoverPublishDayGap({ schedule, now, dryRun: true });
  assert.equal(result.recovered, false);
  assert.notEqual(result.toYmd, '2026-10-12');
});
