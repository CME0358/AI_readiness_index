import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OFFERINGS,
  CASE_STUDIES,
  SAMPLE_REPORT,
  UNRESOLVED_COMMERCIAL,
} from '../lib/service-offerings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('canonical prices match product catalog and improve.html', () => {
  const report = OFFERINGS.find((o) => o.id === 'company_report');
  const local = OFFERINGS.find((o) => o.id === 'local_geo');
  const advisory = OFFERINGS.find((o) => o.id === 'advisory');
  assert.equal(report.priceExTaxYen, 29_800);
  assert.equal(local.priceExTaxYen, 60_000);
  assert.equal(advisory.priceExTaxYen, 198_000);
  const improve = read('improve.html');
  assert.match(improve, /¥198,000/);
  assert.match(improve, /12ヶ月契約/);
  assert.doesNotMatch(improve, /¥60,000/);
});

test('services hub has canonical, schema, and tax-explicit pricing', () => {
  const html = read('services/index.html');
  assert.match(html, /rel="canonical" href="https:\/\/readiness\.coaretail\.com\/services\/"/);
  assert.match(html, /¥29,800/);
  assert.match(html, /月額 ¥60,000/);
  assert.match(html, /税別/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /ga4\.js/);
  assert.doesNotMatch(html, /AggregateRating/);
  assert.doesNotMatch(html, /Review/);
});

test('sample page labels illustrative data and links to report demo', () => {
  const html = read('sample/index.html');
  assert.match(html, /ILLUSTRATIVE|架空/);
  assert.match(html, /report=demo/);
  assert.match(html, new RegExp(SAMPLE_REPORT.demoUrl.replace('?', '\\?')));
  assert.match(html, /実測値ではありません|not a customer deliverable/i);
});

test('Bar SECRET case separates observation from customer claims and avoids invented uplift', () => {
  const html = read('cases/bar-secret/index.html');
  const caseData = CASE_STUDIES.find((c) => c.slug === 'bar-secret');
  assert.ok(caseData);
  assert.match(html, /barsecret\.tokyo/);
  assert.match(html, /観測/);
  assert.match(html, /顧客申告/);
  assert.match(html, /未掲載/);
  assert.doesNotMatch(html, /%\s*増|倍にな|来店数が\d+/);
  assert.doesNotMatch(html, /AggregateRating/);
});

test('unresolved commercial items appear on services page not as promises', () => {
  const html = read('services/index.html');
  for (const item of UNRESOLVED_COMMERCIAL) {
    assert.match(html, new RegExp(item.topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 20)));
  }
  assert.match(html, /未確認|管理用/);
});

test('sitemap and build include new public paths', () => {
  const sitemap = read('sitemap.xml');
  assert.match(sitemap, /readiness\.coaretail\.com\/services\//);
  assert.match(sitemap, /readiness\.coaretail\.com\/sample\//);
  assert.match(sitemap, /readiness\.coaretail\.com\/cases\/bar-secret\//);
  const pkg = read('package.json');
  assert.match(pkg, /public_build\/services/);
  assert.match(pkg, /public_build\/cases/);
});

test('internal links connect research, services, sample, purchase, and consult', () => {
  const services = read('services/index.html');
  assert.match(services, /href="\/research\/"/);
  assert.match(services, /href="\/sample\/"/);
  assert.match(services, /href="\/report\/"/);
  const sample = read('sample/index.html');
  assert.match(sample, /href="\/report\/"/);
  const cases = read('cases/bar-secret/index.html');
  assert.match(cases, /readiness\/mtgschedule/);
  assert.match(cases, /href="\/sample\/"/);
});

test('ga4 service_view includes new commercial paths', () => {
  const ga4 = read('assets/ga4.js');
  assert.match(ga4, /\/services\//);
  assert.match(ga4, /\/cases\//);
  assert.match(ga4, /\/sample\//);
});
