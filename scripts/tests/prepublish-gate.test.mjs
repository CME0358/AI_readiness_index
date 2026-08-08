#!/usr/bin/env node
/**
 * TMVU-05 — Pre-publish editorial gate tests (T01–T15).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runPrepublishEditorialGate,
  checkProtectedAbis,
  checkUnsupportedProperNouns,
  checkAbisLeak,
  extractArticleFields,
  PROTECTED_ABIS_SLUGS,
} from '../lib/prepublish-editorial-gate.mjs';
import { loadSchedule } from '../lib/insights-related-links.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCHEDULED = path.join(ROOT, 'insights/_scheduled');

function readScheduled(slug) {
  return fs.readFileSync(path.join(SCHEDULED, slug, 'index.html'), 'utf8');
}

function scheduleEntry(slug) {
  return loadSchedule().articles.find((a) => a.slug === slug);
}

test('T01 evergreen article can PASS', () => {
  const result = runPrepublishEditorialGate('ari-vs-geo-seo', {
    scheduleEntry: scheduleEntry('ari-vs-geo-seo'),
  });
  assert.notEqual(result.status, 'BLOCKED');
});

test('T02 unsupported proper noun BLOCKED', () => {
  const blockers = checkUnsupportedProperNouns(
    {
      seoTitle: 'ChatGPT完全攻略',
      h1: 'テスト記事',
      meta: 'ChatGPTの攻略',
      lead: 'AI検索対策の基本を整理する。',
    },
    '本文には当該固有名詞の説明がありません。',
  );
  assert.ok(blockers.some((b) => b.code === 'UNSUPPORTED_PROPER_NOUN'));
});

test('T03 protected ABIS slug BLOCKED', () => {
  for (const slug of PROTECTED_ABIS_SLUGS) {
    const r = checkProtectedAbis(slug);
    assert.equal(r.blocked, true);
    assert.equal(r.blockers[0].code, 'PROTECTED_ABIS_PREPUBLICATION');
  }
});

test('T04 ABIS leak in non-ABIS BLOCKED', () => {
  const html = readScheduled('execution-readiness');
  const fields = extractArticleFields(html);
  const blockers = checkAbisLeak('execution-readiness', fields, 'ABISとは新興フレームワークです');
  assert.ok(blockers.some((b) => b.code === 'ABIS_PREPUBLICATION_LEAK'));
});

test('T05 missing CTA BLOCKED via GA4 gate', () => {
  const html = readScheduled('ari-vs-geo-seo').replace(/data-ga-insight-cta="report"/, '');
  const result = runPrepublishEditorialGate('ari-vs-geo-seo', {
    html,
    scheduleEntry: scheduleEntry('ari-vs-geo-seo'),
  });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.blockers.some((b) => b.code === 'GA4_INTEGRITY'));
});

test('T06 broken related link BLOCKED', () => {
  const html = readScheduled('ari-vs-geo-seo').replace(
    /href="\/insights\/([^"]+)"/,
    'href="/insights/nonexistent-slug-xyz/"',
  );
  const result = runPrepublishEditorialGate('ari-vs-geo-seo', {
    html,
    scheduleEntry: scheduleEntry('ari-vs-geo-seo'),
  });
  assert.equal(result.status, 'BLOCKED');
});

test('T07 missing GA4 tracking BLOCKED', () => {
  const html = readScheduled('execution-readiness').replace('/assets/analytics.js', '');
  const result = runPrepublishEditorialGate('execution-readiness', {
    html,
    scheduleEntry: scheduleEntry('execution-readiness'),
  });
  assert.equal(result.status, 'BLOCKED');
});

test('T08 missing OG BLOCKED via SEO gate', () => {
  const html = readScheduled('execution-readiness').replace(/<meta property="og:title"[^>]+>/, '');
  const result = runPrepublishEditorialGate('execution-readiness', {
    html,
    scheduleEntry: scheduleEntry('execution-readiness'),
  });
  assert.equal(result.status, 'BLOCKED');
});

test('T09 time-sensitive fresh PASS or OBSERVATION', () => {
  const entry = { ...scheduleEntry('multi-agent-compare'), freshnessClass: 'time_sensitive', unlockedAt: new Date().toISOString() };
  const result = runPrepublishEditorialGate('multi-agent-compare', { scheduleEntry: entry });
  assert.notEqual(result.status, 'BLOCKED');
});

test('T10 time-sensitive stale BLOCKED', () => {
  const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const entry = {
    ...scheduleEntry('multi-agent-compare'),
    freshnessClass: 'time_sensitive',
    editorialReviewedAt: old,
  };
  const result = runPrepublishEditorialGate('multi-agent-compare', { scheduleEntry: entry });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.blockers.some((b) => b.code === 'STALE_CONTENT_REVIEW_REQUIRED'));
});

test('T11 duplicate exact seoTitle BLOCKED', () => {
  const entry = scheduleEntry('ari-vs-geo-seo');
  const dupEntry = { ...scheduleEntry('execution-readiness'), seoTitle: entry.seoTitle };
  const result = runPrepublishEditorialGate('execution-readiness', { scheduleEntry: dupEntry });
  assert.ok(result.blockers.some((b) => b.code === 'DUPLICATE_SEO_TITLE'));
});

test('T12 high similarity intent OBSERVATION', () => {
  const schedule = loadSchedule();
  const a = schedule.articles.find((x) => x.slug === 'ari-vs-geo-seo');
  const dupEntry = { ...schedule.articles.find((x) => x.slug === 'execution-readiness'), primarySearchIntent: a.primarySearchIntent };
  const result = runPrepublishEditorialGate('execution-readiness', { scheduleEntry: dupEntry, schedule });
  assert.ok(result.observations.some((o) => o.code === 'DUPLICATE_SEARCH_INTENT'));
});

test('T13 numeric mismatch BLOCKED', () => {
  const html = readScheduled('exec-readiness-kpi').replace(
    /<meta name="description" content="[^"]+"/,
    '<meta name="description" content="30社調査に基づくAgent Readiness KPIの設計。検索順位ではなく段階別到達率と実行成功率——経営が見るべきAgent Readiness KPIの設計。基準論ではなく、経営ダッシュボードの指標選定と、Visibility・Authority・Actionabilityの測り方を解説します。"',
  );
  const result = runPrepublishEditorialGate('exec-readiness-kpi', {
    html,
    scheduleEntry: scheduleEntry('exec-readiness-kpi'),
  });
  assert.ok(
    result.status === 'BLOCKED' ||
      result.observations.some((o) => o.code === 'NUMERIC_SURFACE_DRIFT') ||
      result.blockers.some((b) => b.code === 'NUMERIC_MISMATCH'),
  );
});

test('T14 noindex BLOCKED', () => {
  const html = readScheduled('ari-vs-geo-seo').replace(
    '<head>',
    '<head>\n<meta name="robots" content="noindex">',
  );
  const result = runPrepublishEditorialGate('ari-vs-geo-seo', { html, scheduleEntry: scheduleEntry('ari-vs-geo-seo') });
  assert.ok(result.blockers.some((b) => b.code === 'NOINDEX'));
});

test('T15 force protected ABIS still BLOCKED', () => {
  const result = runPrepublishEditorialGate('abis-intro', { forceSlug: 'abis-intro' });
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.blockers.some((b) => b.code === 'PROTECTED_ABIS_PREPUBLICATION'));
});
