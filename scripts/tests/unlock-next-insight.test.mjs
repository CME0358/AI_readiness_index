#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextPublishDayAfterUnlock,
  articleTimesForPublishDay,
} from '../lib/business-days.mjs';
import {
  resolvePublishYmd,
  findNextHoldArticle,
} from '../lib/unlock-next-insight.mjs';

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
