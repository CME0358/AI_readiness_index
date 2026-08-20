#!/usr/bin/env node
/**
 * Agency Partner Preview — route, fixture, and regression tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('partner preview route registered in vercel.json', () => {
  const vercel = read('vercel.json');
  assert.match(vercel, /\/report\/partner-preview\/:path\*/);
  assert.match(vercel, /\/report\/index\.html/);
});

test('main.jsx routes partner-preview before token preview', () => {
  const main = read('report/src/main.jsx');
  assert.match(main, /isPartnerPreviewPath/);
  assert.match(main, /PartnerPreviewPage/);
  assert.match(main, /partnerPreview\s*\?\s*\(\)\s*=>\s*<PartnerPreviewPage/);
  assert.match(main, /partnerPreview\s*\?\s*null\s*:\s*parsePreviewToken/);
});

test('isPartnerPreviewPath matches expected URLs', async () => {
  const mod = await import('../../report/src/partner-preview-routing.js');
  assert.equal(mod.isPartnerPreviewPath('/report/partner-preview/'), true);
  assert.equal(mod.isPartnerPreviewPath('/report/partner-preview'), true);
  assert.equal(mod.isPartnerPreviewPath('/report/partner-preview?utm_source=outbound'), true);
  assert.equal(mod.isPartnerPreviewPath('/report/p/demo-token'), false);
  assert.equal(mod.isPartnerPreviewPath('/report/'), false);
});

test('parsePreviewToken unchanged for direct buyer preview', async () => {
  const mod = await import('../../report/src/partner-preview-routing.js');
  assert.equal(mod.parsePreviewToken('/report/p/adbBaRqj2TuE3t7ntL6LDw'), 'adbBaRqj2TuE3t7ntL6LDw');
  assert.equal(mod.parsePreviewToken('/report/partner-preview/'), null);
});

test('partner preview uses static fixture — no API fetch', () => {
  const page = read('report/src/PartnerPreviewPage.jsx');
  assert.doesNotMatch(page, /fetch\s*\(\s*[`'"]\/api\/preview/);
  assert.match(page, /partner-preview-data\.js/);
});

test('partner preview headline and SAMPLE indication present', () => {
  const page = read('report/src/PartnerPreviewPage.jsx');
  assert.match(page, /検索では見つかるのに/);
  assert.match(page, /AIでは候補から外れていませんか/);
  assert.match(page, /SAMPLE/);
  assert.match(page, /サンプルレポート/);
});

test('partner preview has primary and secondary CTA', async () => {
  const data = await import('../../report/src/partner-preview-data.js');
  assert.match(data.PARTNER_CTA.primary.label, /ARIレポートを確認する/);
  assert.equal(data.PARTNER_CTA.primary.href, '/report/');
  assert.match(data.PARTNER_CTA.secondary.label, /展開について相談/);
  assert.match(data.PARTNER_CTA.secondary.href, /coaretail\.com\/readiness\/mtgschedule/);
});

test('partner fixture avoids fake rankings and real company scores', async () => {
  const data = await import('../../report/src/partner-preview-data.js');
  const serialized = JSON.stringify(data);
  assert.doesNotMatch(serialized, /全国順位|業界平均|競合順位|deviation|rank\.national/);
  assert.match(data.PARTNER_SAMPLE_COMPANY.company_name, /サンプル/);
  assert.match(data.PARTNER_SAMPLE_COMPANY.url, /example\.jp/);
});

test('partner video section has placeholder fallback', () => {
  const component = read('report/src/PartnerPreviewVideo.jsx');
  const data = read('report/src/partner-preview-data.js');
  assert.match(component, /partner-preview-video__placeholder/);
  assert.match(component, /setAssetAvailable\(false\)/);
  assert.match(data, /scene-01-ai-search\.mp4/);
});

test('partner preview sets noindex metadata', () => {
  const page = read('report/src/PartnerPreviewPage.jsx');
  assert.match(page, /noindex,\s*follow/);
});

test('PreviewPage still uses shared CheckBadge', () => {
  const preview = read('report/src/PreviewPage.jsx');
  assert.match(preview, /from "\.\/preview-shared\.jsx"/);
  assert.match(preview, /<CheckBadge/);
  assert.doesNotMatch(preview, /function CheckBadge/);
});

test('partner preview CSS includes mobile breakpoint', () => {
  const css = read('report/src/partner-preview.css');
  assert.match(css, /@media \(max-width: 640px\)/);
});
