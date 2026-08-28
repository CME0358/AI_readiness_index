#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextPublishDayAfterUnlock,
  articleTimesForPublishDay,
} from '../lib/business-days.mjs';
import {
  resolvePublishYmd,
  resolveEffectiveUnlockSlot,
  planUnlock,
  findNextHoldArticle,
  findScheduledOnDate,
  resolveNextAvailablePublishYmd,
  upsertPlannedCard,
} from '../lib/unlock-next-insight.mjs';
import { EDITORIAL_STATUSES } from '../lib/editorial-status.mjs';

test('nextPublishDayAfterUnlock: Aug 4 unlock → Aug 5 publish', () => {
  assert.equal(nextPublishDayAfterUnlock('2026-08-04'), '2026-08-05');
});

test('nextPublishDayAfterUnlock: Friday unlock → Monday publish', () => {
  assert.equal(nextPublishDayAfterUnlock('2026-08-07'), '2026-08-10');
});

test('articleTimesForPublishDay uses standard JST slots', () => {
  const t = articleTimesForPublishDay('2026-08-05');
  assert.equal(t.web, '2026-08-05T10:00:00+09:00');
  assert.equal(t.bufferTransfer, '2026-08-05T10:30:00+09:00');
  assert.equal(t.linkedin, '2026-08-05T11:30:00+09:00');
  assert.equal(t.facebook, '2026-08-05T11:45:00+09:00');
  assert.equal(t.x, '2026-08-05T12:00:00+09:00');
});

test('resolvePublishYmd from unlock day', () => {
  const now = new Date('2026-08-04T15:00:00+09:00');
  assert.equal(resolvePublishYmd({ now }), '2026-08-05');
  assert.equal(resolvePublishYmd({ now, publishDate: '2026-08-06' }), '2026-08-06');
});

test('findNextHoldArticle returns recommendation-logic after ai-search-shift published', () => {
  const schedule = {
    articles: [
      { slug: 'ai-search-shift', series: 'v2', status: 'published' },
      { slug: 'recommendation-logic', series: 'v2', status: 'editorial_hold' },
    ],
  };
  assert.equal(findNextHoldArticle(schedule).slug, 'recommendation-logic');
});

test('upsertPlannedCard keeps earlier current-event when unlocking later v2 slot', () => {
  const html = '<!-- INSIGHTS_CARDS_START -->\n<a class="insight-card">published</a>';
  const schedule = {
    articles: [
      {
        slug: 'cloudflare-aeo',
        status: EDITORIAL_STATUSES.SCHEDULED,
        publishAt: '2026-08-11T10:00:00+09:00',
        series: 'current-event',
        title: 'Cloudflare AEO',
        cardSummary: 'current event summary',
      },
      {
        slug: 'ari-vs-geo-seo',
        status: EDITORIAL_STATUSES.SCHEDULED,
        publishAt: '2026-08-12T10:00:00+09:00',
        series: 'v2',
        title: 'SEO GEO ARI',
        cardSummary: 'evergreen summary',
      },
    ],
  };
  const out = upsertPlannedCard(html, schedule.articles[1], schedule);
  assert.match(out, /data-scheduled-slug="cloudflare-aeo"/);
  assert.doesNotMatch(out, /data-scheduled-slug="ari-vs-geo-seo"/);
  assert.match(out, /Current Event/);
});

test('resolveNextAvailablePublishYmd skips occupied current-event slot', () => {
  const schedule = {
    articles: [
      {
        slug: 'cloudflare-aeo',
        status: EDITORIAL_STATUSES.SCHEDULED,
        publishAt: '2026-08-11T10:00:00+09:00',
      },
    ],
  };
  assert.ok(findScheduledOnDate(schedule, '2026-08-11'));
  assert.equal(resolveNextAvailablePublishYmd(schedule, '2026-08-11'), '2026-08-12');
});

const incidentSlot = '2026-08-27T15:00:00+09:00';

test('effective slot: on-time Thursday unlock targets Friday', () => {
  const slot = resolveEffectiveUnlockSlot({ actualRunAt: new Date(incidentSlot) });
  assert.equal(slot.ok, true);
  assert.equal(slot.effectiveUnlockYmd, '2026-08-27');
  assert.equal(resolvePublishYmd({ now: new Date(incidentSlot) }), '2026-08-28');
});

test('incident reproduction: delayed Friday 02:26 run still targets Friday', () => {
  const actualRunAt = new Date('2026-08-28T02:26:00+09:00');
  const slot = resolveEffectiveUnlockSlot({ actualRunAt });
  assert.equal(slot.ok, true);
  assert.equal(slot.effectiveUnlockYmd, '2026-08-27');
  assert.equal(slot.latenessMinutes, 686);
  assert.equal(resolvePublishYmd({ now: actualRunAt }), '2026-08-28');
  assert.notEqual(resolvePublishYmd({ now: actualRunAt }), '2026-08-31');
});

test('Friday canonical unlock targets Monday', () => {
  assert.equal(resolvePublishYmd({ now: new Date('2026-08-28T15:00:00+09:00') }), '2026-08-31');
});

function holdSchedule(extra = []) {
  return { articles: [{ slug: 'agent-experience', series: 'v2', status: 'editorial_hold' }, ...extra] };
}

test('same unlock slot is idempotent after first article is scheduled', () => {
  const now = new Date('2026-08-28T02:26:00+09:00');
  const first = planUnlock({ schedule: holdSchedule(), now });
  assert.equal(first.result, 'READY_TO_UNLOCK');
  const second = planUnlock({
    schedule: holdSchedule([{ slug: 'agent-experience', series: 'v2', status: 'scheduled', publishAt: '2026-08-28T10:00:00+09:00' }]),
    now,
  });
  assert.equal(second.result, 'NO_OP_ALREADY_SCHEDULED');
});

test('target date already scheduled returns NO_OP_ALREADY_SCHEDULED', () => {
  const result = planUnlock({
    schedule: holdSchedule([{ slug: 'other', series: 'v2', status: 'scheduled', publishAt: '2026-08-28T10:00:00+09:00' }]),
    now: new Date('2026-08-28T02:26:00+09:00'),
  });
  assert.equal(result.result, 'NO_OP_ALREADY_SCHEDULED');
  assert.equal(result.slug, 'other');
});

test('target date already published returns NO_OP_ALREADY_PUBLISHED', () => {
  const result = planUnlock({
    schedule: holdSchedule([{ slug: 'agent-experience', series: 'v2', status: 'published', publishAt: '2026-08-28T10:00:00+09:00', publishedAt: '2026-08-28T10:25:31+09:00' }]),
    now: new Date('2026-08-28T02:26:00+09:00'),
  });
  assert.equal(result.result, 'NO_OP_ALREADY_PUBLISHED');
});

test('future article remains untouched when incident target is available', () => {
  const result = planUnlock({
    schedule: holdSchedule([{ slug: 'agent-handoff', series: 'v2', status: 'scheduled', publishAt: '2026-08-31T10:00:00+09:00' }]),
    now: new Date('2026-08-28T02:26:00+09:00'),
  });
  assert.equal(result.result, 'READY_TO_UNLOCK');
  assert.equal(result.slug, 'agent-experience');
});

test('run beyond lateness window stops safely', () => {
  const result = planUnlock({
    schedule: holdSchedule(),
    now: new Date('2026-08-28T12:00:00+09:00'),
  });
  assert.equal(result.result, 'UNLOCK_STALE_RUN_BLOCKED');
  assert.equal(result.publishYmd, null);
});
