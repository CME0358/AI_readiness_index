import assert from 'node:assert/strict';
import test from 'node:test';
import { upsertPlannedCard, findEarliestScheduledArticle } from '../lib/unlock-next-insight.mjs';
import { EDITORIAL_STATUSES } from '../lib/editorial-status.mjs';

test('post-publish planned card refresh targets earliest remaining scheduled article', () => {
  const schedule = {
    articles: [
      {
        slug: 'publish-me',
        status: EDITORIAL_STATUSES.PUBLISHED,
        publishAt: '2026-09-08T10:00:00+09:00',
        title: 'Publish Me',
        cardSummary: 'summary one',
      },
      {
        slug: 'next-up',
        status: EDITORIAL_STATUSES.SCHEDULED,
        publishAt: '2026-09-09T10:00:00+09:00',
        title: 'Next Up',
        cardSummary: 'summary two',
        series: 'v2',
      },
    ],
  };
  let html = `<!-- INSIGHTS_CARDS_START -->
      <a class="insight-card" data-insight-slug="publish-me">published</a>`;
  const nextPlanned = findEarliestScheduledArticle(schedule);
  html = upsertPlannedCard(html, nextPlanned, schedule);
  assert.match(html, /data-scheduled-slug="next-up"/);
  assert.doesNotMatch(html, /data-scheduled-slug="publish-me"/);
});
