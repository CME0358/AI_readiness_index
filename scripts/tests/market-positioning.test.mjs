#!/usr/bin/env node
/**
 * RMVU-04F — ARI Market Positioning Alignment tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTECTED_ABIS_SLUGS } from '../lib/product-integrity.mjs';
import { PRODUCTS } from '../lib/product-catalog.mjs';
import { RESEARCH_EDITION } from '../lib/product-catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('RMVU-04F T01 Homepage definition includes business / recommendation framing', () => {
  const home = read('index.html');
  assert.match(home, /発見・理解・比較・推薦/);
  assert.match(home, /行動/);
  assert.match(home, /Agent Readiness Index（ARI）/);
});

test('RMVU-04F T02 Homepage does not define ARI as technical-only', () => {
  const home = read('index.html');
  assert.match(home, /Technical Readiness Scannerではありません/);
  assert.doesNotMatch(home, /robots\.txt checker/i);
  assert.doesNotMatch(home, /WebMCP scanner/i);
});

test('RMVU-04F T03 Report positioning is Decision Product', () => {
  const reportHtml = read('report/index.html');
  const reportJsx = read('report/src/agent-readiness-report.jsx');
  assert.match(reportHtml, /Decision Product/);
  assert.match(reportJsx, /Decision Report/);
  assert.match(reportJsx, /改善優先順位/);
});

test('RMVU-04F T04 Research positioning focuses AI recognition / comparison / recommendation', () => {
  const research = read('research/index.html');
  assert.match(research, /理解され・比較され・推薦され・実行される/);
  assert.match(research, /Discovery/);
  assert.match(research, /Recommendation/);
});

test('RMVU-04F T05 Advisory positioning is continuous business-readiness improvement', () => {
  const improve = read('improve.html');
  assert.match(improve, /Business \/ Recommendation Readiness/);
  assert.match(improve, /実装・計測・再評価/);
  assert.match(improve, /¥198,000/);
  assert.match(improve, /12ヶ月契約/);
});

test('RMVU-04F T06 Technical signals remain subordinate', () => {
  const framework = read('framework/index.html');
  const reportJsx = read('report/src/agent-readiness-report.jsx');
  assert.match(framework, /シグナルとして位置づける/);
  assert.match(reportJsx, /技術シグナル/);
  assert.match(reportJsx, /Technical Scannerと定義するものではありません/);
});

test('RMVU-04F T07 Company Report ¥29,800 preserved', () => {
  const home = read('index.html');
  const reportJsx = read('report/src/agent-readiness-report.jsx');
  assert.match(home, /¥29,800/);
  assert.match(reportJsx, /¥29,800/);
  assert.equal(PRODUCTS.companyReportBundle.priceExTax, 29_800);
});

test('RMVU-04F T08 Advisory pricing preserved', () => {
  const improve = read('improve.html');
  assert.match(improve, /月額 ¥198,000〜（税別）/);
  assert.match(improve, /250,000/);
  assert.match(improve, /300,000/);
});

test('RMVU-04F T09 Stripe Bundle preserved', () => {
  const fulfillment = read('report/src/fulfillment.js');
  assert.match(fulfillment, /VITE_COMPANY_REPORT_BUNDLE_PAYMENT_URL/);
  assert.match(fulfillment, /allowLegacy:\s*false/);
});

test('RMVU-04F T10 No certification public program on primary surfaces', () => {
  for (const rel of ['index.html', 'report/index.html', 'improve.html', 'research/index.html']) {
    const src = read(rel);
    assert.doesNotMatch(src, /Agent Ready Certification/);
    assert.doesNotMatch(src, /認証審査/);
  }
});

test('RMVU-04F T11 No ABIS exposure', () => {
  for (const rel of ['index.html', 'report/src/agent-readiness-report.jsx', 'improve.html']) {
    const src = read(rel);
    for (const slug of PROTECTED_ABIS_SLUGS) {
      assert.doesNotMatch(src, new RegExp(slug));
    }
  }
});

test('RMVU-04F T12 Protected slugs unchanged in catalog', () => {
  assert.equal(PROTECTED_ABIS_SLUGS.length, 6);
  assert.ok(PROTECTED_ABIS_SLUGS.includes('abis-intro'));
});

test('RMVU-04F T13 TMVU SEO hooks preserved on homepage', () => {
  const home = read('index.html');
  assert.match(home, /rel="canonical"/);
  assert.match(home, /application\/ld\+json/);
  assert.match(home, /og:title|property="og:title"/);
});

test('RMVU-04F T14 GA4 hooks preserved', () => {
  const reportJsx = read('report/src/agent-readiness-report.jsx');
  const reportAnalytics = read('report/src/analytics.js');
  const insightAnalytics = read('assets/analytics.js');
  assert.match(reportJsx, /trackReportStartOnce/);
  assert.match(reportAnalytics, /report_checkout_start/);
  assert.match(reportAnalytics, /report_result_view/);
  assert.match(insightAnalytics, /insight_cta_report/);
});

test('RMVU-04F T15 Research fulfillment preserved', () => {
  assert.equal(RESEARCH_EDITION.bundleDownloadPath, '/whitepaper/2026/research/download.html');
  const reportJsx = read('report/src/agent-readiness-report.jsx');
  assert.match(reportJsx, /openResearchEdition/);
  assert.match(reportJsx, /ARI Research Report 2026/);
});

test('RMVU-04F legacy TBD removed from public whitepaper surfaces', () => {
  const free = read('whitepaper/2026/free/index.html');
  const handbook = read('whitepaper/2026/handbook/index.html');
  assert.doesNotMatch(free, /TBD \/ Consultation/);
  assert.doesNotMatch(handbook, /TBD \/ Consultation/);
  assert.match(free, /¥198,000/);
  assert.match(handbook, /¥198,000/);
});

test('RMVU-04F no Cloudflare competitor mentions on public surfaces', () => {
  for (const rel of ['index.html', 'framework/index.html', 'research/index.html', 'improve.html']) {
    assert.doesNotMatch(read(rel), /Cloudflare/i);
  }
});
