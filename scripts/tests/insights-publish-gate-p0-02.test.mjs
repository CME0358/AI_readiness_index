import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  looksLikeEditorialMemo,
  resolvePublicCardSummary,
  shortenForCard,
} from '../lib/insights-card-summary.mjs';
import {
  buildInsightsIndexCardsBlock,
  listPublishedScheduleArticles,
  resolvePlannedArticle,
  syncInsightsPublicSurfaces,
  assertNoUnpublishedSurfaceLeak,
} from '../lib/insights-public-sync.mjs';
import { EDITORIAL_STATUSES } from '../lib/editorial-status.mjs';
import { extractDueArticles, selectNextDueArticle } from '../lib/editorial-status.mjs';
import { publishDueArticles } from '../lib/publish-scheduled-insights-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('P0-02 editorial memo tails are detected without rejecting punctuated comparisons', () => {
  assert.equal(
    looksLikeEditorialMemo('部門横断の情報オーナーシップと更新ルールが必要。定義ではなく運用設計とオーナーシップ'),
    true
  );
  assert.equal(
    looksLikeEditorialMemo('検索順位ではなく段階別到達率と実行成功率——経営が見るべきAgent Readiness KPIの設計。'),
    false
  );
  assert.equal(
    looksLikeEditorialMemo('サイバーエージェントGEOラボ調査で生成AI検索利用率が52.3%に。検索エンジンに次ぐ第二プラットフォームとして、企業がVisibility・Authorit'),
    true
  );
});

test('P0-02 resolvePublicCardSummary prefers metaDescription over memo cardSummary', () => {
  const article = {
    slug: 'three-pillars-ops',
    title: 'Visibility・Authority・Actionabilityを運用に落とす',
    cardSummary: '部門横断の情報オーナーシップと更新ルールが必要。定義ではなく運用設計とオーナーシップ',
    metaDescription: '三柱は概念理解だけでは機能しない。Visibility・Authority・Actionabilityそれぞれにオーナーと更新ルールを定義し、部門横断で運用に落とすことがAgent Readiness改善の起点になる。',
  };
  const summary = resolvePublicCardSummary(article);
  assert.match(summary, /三柱は概念理解だけでは機能しない/);
  assert.doesNotMatch(summary, /定義ではなく運用設計とオーナーシップ$/);
});

test('P0-02 exec-readiness-kpi summary keeps legitimate ではなく comparison', () => {
  const article = {
    slug: 'exec-readiness-kpi',
    title: '経営が見るべきReadiness指標',
    cardSummary: '順位ではなく段階別到達率と実行成功率を見る。基準論ではなく経営KPI設計',
    metaDescription: '検索順位ではなく段階別到達率と実行成功率——経営が見るべきAgent Readiness KPIの設計。基準論ではなく、経営ダッシュボードの指標選定と、Visibility・Authority・Actionabilityの測り方を解説します。',
  };
  const summary = resolvePublicCardSummary(article);
  assert.match(summary, /検索順位ではなく段階別到達率/);
  assert.doesNotMatch(summary, /基準論ではなく経営KPI設計$/);
});

test('P0-02 JST 10:00 boundary — before due is not publish eligible', () => {
  const articles = [{
    slug: 'due-today',
    status: EDITORIAL_STATUSES.SCHEDULED,
    publishAt: '2026-09-08T10:00:00+09:00',
  }];
  const before = new Date('2026-09-08T09:59:59+09:00');
  const at = new Date('2026-09-08T10:00:00+09:00');
  assert.equal(extractDueArticles(articles, before).length, 0);
  assert.equal(selectNextDueArticle(articles, at)?.slug, 'due-today');
});

test('P0-02 cancelled/removed scheduled article is excluded from planned card selection', () => {
  const schedule = {
    articles: [
      { slug: 'published-one', status: EDITORIAL_STATUSES.PUBLISHED, publishAt: '2026-09-07T10:00:00+09:00' },
      { slug: 'cancelled', status: EDITORIAL_STATUSES.HOLD, publishAt: null },
      { slug: 'next', status: EDITORIAL_STATUSES.SCHEDULED, publishAt: '2026-09-14T10:00:00+09:00', title: 'Next' },
    ],
  };
  const planned = resolvePlannedArticle(schedule);
  assert.equal(planned.slug, 'next');
  const block = buildInsightsIndexCardsBlock(schedule);
  assert.match(block, /data-scheduled-slug="next"/);
  assert.doesNotMatch(block, /data-scheduled-slug="cancelled"/);
});

test('P0-02 sync rebuild excludes unpublished slugs from sitemap and llms', () => {
  const schedule = JSON.parse(fs.readFileSync(path.join(ROOT, 'insights/_scheduled/schedule.json'), 'utf8'));
  const dry = syncInsightsPublicSurfaces({ dryRun: true });
  const indexHtml = fs.readFileSync(path.join(ROOT, 'insights/index.html'), 'utf8');
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const llms = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8');
  const errors = assertNoUnpublishedSurfaceLeak(schedule, { indexHtml, sitemap, llms });
  assert.equal(errors.length, 0, errors.join('; '));
  assert.ok(dry.published.length > 0);
  if (dry.planned) {
    assert.match(indexHtml, new RegExp(`data-scheduled-slug="${dry.planned}"`));
    assert.doesNotMatch(sitemap, new RegExp(`/insights/${dry.planned}/`));
  }
});

test('P0-02 publishDueArticles dry-run does not mutate public surfaces', () => {
  const beforeIndex = fs.readFileSync(path.join(ROOT, 'insights/index.html'), 'utf8');
  publishDueArticles({ now: new Date('2026-09-08T09:00:00+09:00'), dryRun: true });
  const afterIndex = fs.readFileSync(path.join(ROOT, 'insights/index.html'), 'utf8');
  assert.equal(beforeIndex, afterIndex);
});

test('P0-02 shortenForCard preserves comparison inside sentence', () => {
  const text = 'SEOやMEOの成果を否定せず、AIが理解・比較・行動につなげるために追加で確認したい項目を整理します。';
  assert.equal(shortenForCard(text, 200), text);
});
