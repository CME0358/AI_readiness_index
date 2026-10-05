#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listWeekdayGaps, recoverPublishDayGap, recoverAllPublishDayGaps, findGapScanWindow, isHeldPublishDate } from '../lib/publish-day-gap-recovery.mjs';
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

test('held publish date is not an open slot', () => {
  const schedule = {
    policy: {
      heldPublishDates: [
        { date: '2026-10-05', slug: 'held-article', reason: 'held_not_cancelled' },
      ],
    },
    articles: [],
  };
  assert.equal(isHeldPublishDate(schedule, '2026-10-05'), true);
  const gaps = listWeekdayGaps(schedule, { startYmd: '2026-10-05', endYmd: '2026-10-06' });
  assert.equal(gaps.includes('2026-10-05'), false);
  assert.equal(gaps.includes('2026-10-06'), true);
});

test('recoverPublishDayGap does not pull the next article onto a held date', () => {
  const schedule = {
    policy: {
      heldPublishDates: [
        { date: '2026-10-05', slug: 'held-article', reason: 'held_not_cancelled' },
      ],
    },
    articles: [
      {
        slug: 'next',
        status: EDITORIAL_STATUSES.SCHEDULED,
        publishAt: '2026-10-06T10:00:00+09:00',
        title: 'Next',
        cardSummary: 'summary',
        series: 'v2',
      },
    ],
  };
  const result = recoverPublishDayGap({
    schedule,
    now: new Date('2026-10-04T10:00:00+09:00'),
    dryRun: true,
  });
  assert.equal(result.recovered, false);
  assert.equal(result.reason, 'held_not_cancelled');
  assert.notEqual(result.toYmd, '2026-10-05');
  assert.equal(schedule.articles[0].publishAt, '2026-10-06T10:00:00+09:00');
});

test('schedule.json holds 2026-10-05 and moves only the spam update to 2026-10-16', () => {
  const schedule = JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
  const bySlug = Object.fromEntries(schedule.articles.map((article) => [article.slug, article]));
  const spam = bySlug['september-2026-spam-update'];
  assert.equal(spam.status, 'scheduled');
  assert.equal(spam.publishAt, '2026-10-16T10:00:00+09:00');
  assert.equal(spam.slotDate, '2026-10-16');
  assert.equal(spam.scheduledPublishAt, '2026-10-16T10:00:00+09:00');

  const onHeldDay = schedule.articles.filter((article) => {
    const dates = [article.slotDate, article.publishAt, article.scheduledPublishAt]
      .filter(Boolean)
      .map((value) => String(value).slice(0, 10));
    return dates.includes('2026-10-05');
  });
  assert.deepEqual(onHeldDay.map((article) => article.slug), ['gemini-utm-and-st-source']);
  const utm = bySlug['gemini-utm-and-st-source'];
  assert.equal(utm.status, 'scheduled');
  assert.equal(utm.publishAt, '2026-10-05T10:00:00+09:00');
  assert.equal(utm.slotDate, '2026-10-05');
  assert.equal(utm.scheduledPublishAt, '2026-10-05T10:00:00+09:00');

  const hold = schedule.policy.heldPublishDates.find((entry) => entry.date === '2026-10-05');
  assert.equal(hold.slug, 'september-2026-spam-update');
  assert.equal(hold.reason, 'held_not_cancelled');
  assert.match(hold.note, /gemini-utm-and-st-source/);
  assert.match(hold.note, /merchant-center-native-checkout-holiday/);

  const slots = {
    'merchant-center-native-checkout-holiday': '2026-10-06',
    'uk-cma-choice-screens-three-shelves': '2026-10-07',
    'ai-mode-information-monitoring': '2026-10-08',
    'branded-queries-ai-overviews': '2026-10-09',
    'bing-edge-ai-mode-naming': '2026-10-13',
    'ai-contribution-pilot-economics': '2026-10-14',
    'aio-citation-cards-and-loading': '2026-10-15',
  };
  for (const [slug, ymd] of Object.entries(slots)) {
    assert.equal(bySlug[slug].publishAt, `${ymd}T10:00:00+09:00`);
    assert.equal(bySlug[slug].slotDate, ymd);
    assert.equal(bySlug[slug].scheduledPublishAt, `${ymd}T10:00:00+09:00`);
    assert.equal(bySlug[slug].status, 'scheduled');
  }

  const heldSlugs = [
    'abis-ari-bridge',
    'abis-intro',
    'abis-readiness-gap',
    'consent-data-design',
    'interaction-contract',
    'standards-landscape',
    'vendor-selection',
  ];
  for (const slug of heldSlugs) {
    assert.equal(bySlug[slug].status, 'editorial_hold');
    assert.equal(bySlug[slug].publishAt, null);
  }

  const now = new Date('2026-10-04T10:00:00+09:00');
  const gaps = listWeekdayGaps(schedule, findGapScanWindow(schedule, now));
  assert.equal(gaps.includes('2026-10-05'), false);
  assert.equal(gaps.includes('2026-10-12'), false);
  const result = recoverPublishDayGap({ schedule, now, dryRun: true });
  assert.equal(result.recovered, false);
  assert.equal(result.reason, 'held_not_cancelled');
  assert.notEqual(result.toYmd, '2026-10-05');
  assert.equal(bySlug['merchant-center-native-checkout-holiday'].publishAt, '2026-10-06T10:00:00+09:00');
});
