import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const reportSource = read('report/src/agent-readiness-report.jsx');
const analyticsSource = read('report/src/analytics.js');
const catalogSource = read('scripts/lib/product-catalog.mjs');
const proofStart = reportSource.indexOf('id="proof"');
const proofEnd = reportSource.indexOf('<section className="lp-section" id="how">', proofStart);
const proof = reportSource.slice(proofStart, proofEnd);

test('Company Report proof section is decision-oriented', () => {
  assert.notEqual(proofStart, -1);
  assert.match(proof, /¥29,800で分かること/);
  assert.match(proof, /OBSERVATION/);
  assert.match(proof, /WHAT AI CAN SEE/);
  assert.match(proof, /GAP/);
  assert.match(proof, /WHY IT MATTERS/);
  assert.match(proof, /PRIORITY \/ NEXT ACTION/);
  assert.match(proof, /レポートを読んだあとに決められること/);
});

test('proof uses a representative disclaimer and no fake customer case language', () => {
  assert.match(proof, /代表例です。実際の分析結果は対象企業・サイトによって異なります/);
  assert.doesNotMatch(proof, /実績|導入事例|顧客事例|改善実績/);
});

test('82 / Leader is no longer the landing proof centerpiece', () => {
  assert.doesNotMatch(proof, />82<|Leader/);
  assert.match(reportSource, /const DUMMY_REPORT =/);
  assert.match(reportSource, /reportMode === "sample"/);
});

test('price, primary purchase CTA, and Stripe wiring remain intact', () => {
  assert.match(reportSource, /¥29,800/);
  assert.match(reportSource, /¥32,780/);
  assert.match(reportSource, /resolveCheckoutUrl/);
  assert.match(reportSource, /verifyPurchaseSession/);
  assert.match(reportSource, /onReportCheckoutStart/);
  assert.match(catalogSource, /priceExTax: 29_800/);
  assert.match(catalogSource, /priceTaxIncl: STRIPE_AMOUNT_TAX_INCL\.companyReport/);
  assert.match(catalogSource, /https:\/\/buy\.stripe\.com\/9B600kecb8iBdMTb5hcMM0g/);
});

test('Local GEO bridge is secondary and does not replace Advisory logic', () => {
  assert.match(proof, /https:\/\/localgeo\.coaretail\.com\/\?utm_source=ari_report/);
  assert.match(proof, /variant="outline"/);
  assert.match(proof, /月額60,000円/);
  assert.match(reportSource, /className="report-advisory-cta no-print"/);
  assert.match(reportSource, /Agent Readiness Advisory/);
});

test('proof analytics and checkout analytics contain no PII', () => {
  assert.match(analyticsSource, /trackReportProofImpression/);
  assert.match(analyticsSource, /report_proof_impression/);
  assert.match(analyticsSource, /local_cta_click/);
  assert.match(analyticsSource, /delete safe\.email/);
  assert.match(analyticsSource, /delete safe\.company/);
  assert.match(analyticsSource, /delete safe\.url/);
  assert.match(reportSource, /onReportCheckoutStart\(checkout\)/);
});

test('Phase 9B public-check remains isolated from the report proof change', () => {
  const publicCheck = read('api/public-check.js');
  const publicCheckLib = read('scripts/lib/funnel/public-check.mjs');
  assert.match(publicCheck, /runPublicCheck/);
  assert.doesNotMatch(publicCheck, /buildReport|OPENAI_API_KEY/);
  assert.doesNotMatch(publicCheckLib, /buildReport|OPENAI_API_KEY/);
});
