#!/usr/bin/env node
/**
 * RMVU-05H — Cloudflare AEO editorial article tests (T01–T26).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPrepublishEditorialGate } from '../lib/prepublish-editorial-gate.mjs';
import { getScheduledSeoPackage, validateInsightSeo } from '../lib/insights-seo-package.mjs';
import { loadSchedule } from '../lib/insights-related-links.mjs';
import {
  findScheduledOnDate,
  resolveNextAvailablePublishYmd,
} from '../lib/unlock-next-insight.mjs';
import { EDITORIAL_STATUSES } from '../lib/editorial-status.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SLUG = 'cloudflare-aeo';
const HTML_PATH = path.join(ROOT, 'insights/_scheduled', SLUG, 'index.html');
const SOURCE_URL = 'https://blog.cloudflare.com/aeo';
const PRIORITY_SLOT = '2026-08-11T10:00:00+09:00';

function readHtml() {
  return fs.readFileSync(HTML_PATH, 'utf8');
}

function scheduleEntry() {
  return loadSchedule().articles.find((a) => a.slug === SLUG);
}

const gateEntry = {
  slug: SLUG,
  primarySearchIntent: 'Cloudflare AEO AI検索',
  seoTitle: 'Cloudflareが「順位」から「AI推薦」へ：企業サイトは何を変えるべきか',
  freshnessClass: 'time_sensitive',
  editorialReviewedAt: '2026-08-09T15:00:00+09:00',
};

test('T01 article exists', () => {
  assert.ok(fs.existsSync(HTML_PATH), `${SLUG}/index.html must exist`);
});

test('T02 official Cloudflare source present', () => {
  const html = readHtml();
  assert.ok(html.includes(SOURCE_URL), 'Primary Cloudflare source URL required');
  assert.ok(html.includes('Primary Source'), 'Source block heading required');
});

test('T03 ranking/recommended framing present', () => {
  const html = readHtml();
  assert.match(html, /ranking/i);
  assert.match(html, /recommended|推薦/);
});

test('T04 ARI Business Readiness interpretation present', () => {
  const html = readHtml();
  assert.match(html, /Discovery|Understanding|Comparison|Recommendation|Action/);
  assert.match(html, /Agent Readiness|ARI/);
});

test('T05 technical-only framing absent', () => {
  const html = readHtml();
  const body = html.match(/<article[\s\S]*<\/article>/)?.[0] ?? html;
  assert.match(body, /一貫性|比較|行動導線|Business/);
  assert.doesNotMatch(body, /robots\.txtだけで十分/);
});

test('T06 Company Report CTA present', () => {
  const html = readHtml();
  assert.ok(html.includes('href="/report/"'));
  assert.ok(html.includes('自社の改善優先順位を確認する'));
});

test('T07 GA4 hook preserved', () => {
  const html = readHtml();
  assert.ok(html.includes('data-ga-insight-cta="report"'));
  assert.ok(html.includes('/assets/analytics.js'));
  assert.ok(html.includes(`data-article-slug="${SLUG}"`));
});

test('T08 no ABIS', () => {
  const html = readHtml();
  assert.doesNotMatch(html, /\bABIS\b/);
  assert.doesNotMatch(html, /Agent Business Interaction Standard/i);
});

test('T09 no protected slugs', () => {
  const html = readHtml();
  for (const protectedSlug of ['abis-intro', 'abis-ari-bridge', 'abis-readiness-gap', 'standards-landscape']) {
    assert.doesNotMatch(html, new RegExp(`/insights/${protectedSlug}/`));
  }
});

test('T10 no Cloudflare competitor attack', () => {
  const html = readHtml();
  assert.doesNotMatch(html, /Cloudflareより|Cloudflareの方が劣|競合として/i);
});

test('T11 metadata valid', () => {
  const pkg = getScheduledSeoPackage(SLUG);
  assert.ok(pkg, 'SEO package must exist');
  const errors = validateInsightSeo(readHtml(), SLUG, { scheduled: true });
  assert.equal(errors.length, 0, errors.join('; '));
});

test('T12 BlogPosting JSON-LD valid', () => {
  const html = readHtml();
  const jsonMatch = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)<\/script>/);
  assert.ok(jsonMatch, 'JSON-LD required');
  const ld = JSON.parse(jsonMatch[1]);
  assert.equal(ld['@type'], 'BlogPosting');
  assert.equal(ld.headline, getScheduledSeoPackage(SLUG).h1);
});

test('T13 article marked current event / editorial type', () => {
  const html = readHtml();
  assert.ok(html.includes('Current Event'));
  assert.ok(html.includes('data-editorial-type="current-event"'));
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld.articleSection, 'Current Event');
});

test('T14 cloudflare-aeo scheduled for priority slot', () => {
  const entry = scheduleEntry();
  assert.ok(entry, 'cloudflare-aeo must be in schedule.json');
  assert.equal(entry.status, EDITORIAL_STATUSES.SCHEDULED);
  assert.equal(entry.publishAt, PRIORITY_SLOT);
  assert.equal(entry.series, 'current-event');
});

test('T15 ari-vs-geo-seo remains editorial_hold', () => {
  const sched = loadSchedule();
  const ariVs = sched.articles.find((a) => a.slug === 'ari-vs-geo-seo');
  assert.equal(ariVs?.status, 'editorial_hold');
  assert.equal(ariVs?.priorityDeferredBy, 'cloudflare-aeo');
});

test('T16 prepublish gate PASS', () => {
  const result = runPrepublishEditorialGate(SLUG, { scheduleEntry: gateEntry });
  assert.notEqual(result.status, 'BLOCKED', result.blockers.map((b) => b.message).join('; '));
});

test('T17 cloudflare-aeo is next priority slot after three-pillars-ops', () => {
  const sched = loadSchedule();
  const three = sched.articles.find((a) => a.slug === 'three-pillars-ops');
  const cf = scheduleEntry();
  assert.equal(three?.status, EDITORIAL_STATUSES.SCHEDULED);
  assert.ok(three.publishAt < cf.publishAt);
});

test('T18 ari-vs-geo-seo preserved and deferred', () => {
  const sched = loadSchedule();
  const ariVs = sched.articles.find((a) => a.slug === 'ari-vs-geo-seo');
  assert.ok(ariVs, 'ari-vs-geo-seo must remain in schedule');
  assert.equal(ariVs.status, EDITORIAL_STATUSES.HOLD);
  assert.ok(ariVs.expectedSlotAfter);
});

test('T19 no duplicate schedule entry', () => {
  const sched = loadSchedule();
  const matches = sched.articles.filter((a) => a.slug === SLUG);
  assert.equal(matches.length, 1);
});

test('T20 Evergreen relative order preserved', () => {
  const sched = loadSchedule();
  const hold = sched.articles.filter((a) => a.series === 'v2' && a.status === EDITORIAL_STATUSES.HOLD);
  assert.equal(hold[0]?.slug, 'ari-vs-geo-seo');
  assert.equal(hold[1]?.slug, 'readiness-baseline');
});

test('T21 protected ABIS schedule unchanged', () => {
  const sched = loadSchedule();
  for (const slug of ['abis-intro', 'abis-ari-bridge', 'abis-readiness-gap', 'standards-landscape']) {
    const entry = sched.articles.find((a) => a.slug === slug);
    assert.equal(entry?.status, EDITORIAL_STATUSES.HOLD);
  }
});

test('T22 Theme 2/3 external publication remains HOLD for displaced evergreen', () => {
  const sched = loadSchedule();
  const ariVs = sched.articles.find((a) => a.slug === 'ari-vs-geo-seo');
  assert.equal(ariVs?.status, EDITORIAL_STATUSES.HOLD);
  assert.ok(!fs.existsSync(path.join(ROOT, 'insights/ari-vs-geo-seo/index.html')));
});

test('T23 GA4 report CTA preserved', () => {
  const html = readHtml();
  assert.ok(html.includes('data-ga-insight-cta="report"'));
  assert.ok(html.includes('/report/'));
});

test('T24 no manual IndexNow trigger in release scope', () => {
  const indexnow = fs.readFileSync(path.join(ROOT, 'scripts/submit-indexnow.mjs'), 'utf8');
  assert.doesNotMatch(indexnow, /cloudflare-aeo/);
  assert.ok(!fs.existsSync(path.join(ROOT, 'scripts/submit-cloudflare-aeo-indexnow.mjs')));
});

test('T25 Cloudflare not described as technical-only', () => {
  const html = readHtml();
  const body = html.match(/<article[\s\S]*<\/article>/)?.[0] ?? html;
  assert.match(body, /推薦可視性|AEO|operator|オペレーター/i);
  assert.match(body, /役割分担|Business \/ Recommendation Readiness/);
  assert.doesNotMatch(body, /technical readiness only|技術対応だけがすべて/i);
});

test('T26 unlock skips occupied slot for displaced Evergreen', () => {
  const sched = loadSchedule();
  assert.ok(findScheduledOnDate(sched, '2026-08-11'));
  const next = resolveNextAvailablePublishYmd(sched, '2026-08-11');
  assert.equal(next, '2026-08-12');
});
