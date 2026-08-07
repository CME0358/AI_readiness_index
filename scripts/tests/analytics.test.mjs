#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  applyInsightGa4Tracking,
  validateInsightGa4Tracking,
  reportAppHasReportStart,
} from '../lib/insights-ga4-tracking.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const analyticsSrc = fs.readFileSync(path.join(ROOT, 'assets/analytics.js'), 'utf8');

function loadAnalyticsWithMockGtag() {
  const calls = [];
  const context = {
    window: {
      gtag: (...args) => calls.push(args),
      location: { pathname: '/insights/llms-txt/' },
      addEventListener: () => {},
    },
    document: {
      readyState: 'complete',
      querySelector: () => null,
      addEventListener: () => {},
    },
  };
  context.window = context.window;
  vm.runInNewContext(analyticsSrc, context);
  return { calls, trackGaEvent: context.window.trackGaEvent };
}

const sampleHtml = `<!DOCTYPE html>
<html><head><script src="/assets/ga4.js" async></script></head><body>
<article class="article-body container">
<div class="article-cta">
<a href="/framework/" class="btn btn-navy">Framework</a>
<a href="/research/" class="btn btn-secondary">Research Hub</a>
<a href="/report/" class="btn btn-secondary">ARI診断</a>
</div>
</article></body></html>`;

test('T01 Framework click fires insight_cta_framework', () => {
  const { html } = applyInsightGa4Tracking(sampleHtml, 'llms-txt');
  assert.match(html, /data-ga-insight-cta="framework"/);
  const errs = validateInsightGa4Tracking(html, 'llms-txt');
  assert.equal(errs.length, 0);
});

test('T02 Research click mapping present', () => {
  const { html } = applyInsightGa4Tracking(sampleHtml, 'llms-txt');
  assert.match(html, /data-ga-insight-cta="research"/);
});

test('T03 Report click mapping present', () => {
  const { html } = applyInsightGa4Tracking(sampleHtml, 'llms-txt');
  assert.match(html, /data-ga-insight-cta="report"/);
});

test('T04 article slug attribute present', () => {
  const { html } = applyInsightGa4Tracking(sampleHtml, 'llms-txt');
  assert.match(html, /data-article-slug="llms-txt"/);
});

test('T05 gtag unavailable is no-op', () => {
  const context = {
    window: { location: { pathname: '/insights/test/' } },
    document: { readyState: 'complete', querySelector: () => null, addEventListener: () => {} },
  };
  assert.doesNotThrow(() => vm.runInNewContext(analyticsSrc, context));
});

test('T06 trackGaEvent sends expected event name', () => {
  const { calls, trackGaEvent } = loadAnalyticsWithMockGtag();
  trackGaEvent('insight_cta_framework', {
    article_slug: 'llms-txt',
    destination: '/framework/',
    cta_type: 'framework',
    page_path: '/insights/llms-txt/',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'event');
  assert.equal(calls[0][1], 'insight_cta_framework');
  assert.equal(calls[0][2].article_slug, 'llms-txt');
});

test('T07 report app integrates report_start on handleStart', () => {
  const src = fs.readFileSync(path.join(ROOT, 'report/src/agent-readiness-report.jsx'), 'utf8');
  const reportAnalytics = fs.readFileSync(path.join(ROOT, 'report/src/analytics.js'), 'utf8');
  assert.equal(reportAppHasReportStart(src, reportAnalytics), true);
  const handleStartBlock = src.match(/const handleStart\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*\};/);
  assert.ok(handleStartBlock, 'handleStart block should exist');
  assert.match(handleStartBlock[0], /trackReportStartOnce\(\)/);
  assert.doesNotMatch(handleStartBlock[0], /useEffect/);
});

test('T08 event params exclude PII field names', () => {
  const { calls, trackGaEvent } = loadAnalyticsWithMockGtag();
  trackGaEvent('insight_cta_report', {
    article_slug: 'act',
    article_title: 'Title',
    destination: '/report/',
    cta_type: 'report',
    page_path: '/insights/act/',
  });
  const params = calls[0][2];
  assert.equal(params.email, undefined);
  assert.equal(params.phone, undefined);
  assert.equal(params.company, undefined);
});

test('protected ABIS apply is skipped', () => {
  const { skipped } = applyInsightGa4Tracking(sampleHtml, 'abis-intro');
  assert.equal(skipped, 'protected');
});
