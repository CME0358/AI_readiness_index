#!/usr/bin/env node
/**
 * Provisional Commercial-Fit Canary 10 — Production E2E (no send).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePreviewVideo } from '../report/src/video-carousel-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VAULT = path.resolve(ROOT, '../../..');
const SCAN_JSON = path.join(
  VAULT,
  '70_outputs/5-Day-Sales-Sprint/P1-Commercial-Fit-Scan-2026-08-15.json',
);
const PRODUCTION = 'https://readiness.coaretail.com';
const CANARY_DOMAINS = [
  'azabujuban-ekimae-dc.com',
  'dovoyamadai.com',
  'halilon.jp',
  'kikutake-dental.com',
  'kohjidc.com',
  's-y-dc.com',
  'sakura.markcity-sika.com',
  'takaido-dental.com',
  'mens-c-sharp.com',
  'misa.clinic',
];

const LEAK_PATTERNS = [
  /generic_scan/i,
  /evidence_source/i,
  /crawler_data/i,
  /raw_html/i,
  /scan_error/i,
  /OBS_[A-Z0-9_]+(?:\.copy|_raw)/,
  /approved_copy_raw/i,
  /policy_fingerprint/i,
  /upstash/i,
];

function loadCanaryRows() {
  const payload = JSON.parse(fs.readFileSync(SCAN_JSON, 'utf8'));
  const byDomain = Object.fromEntries(
    (payload.all_p1_candidates || []).map((r) => [r.domain, r]),
  );
  return CANARY_DOMAINS.map((d) => {
    const row = byDomain[d];
    if (!row) throw new Error(`missing scan row for ${d}`);
    return row;
  });
}

async function fetchStatus(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'canary10-e2e/1.0' } });
  const text = await res.text();
  return { status: res.status, text, ok: res.ok };
}

function checkLeakage(text) {
  return LEAK_PATTERNS.filter((re) => re.test(text)).map((re) => re.source);
}

async function verifyCandidate(row) {
  const token = row.preview_token;
  const expectedSegment = row.video_segment;
  const expectedAsset = row.resolved_video_asset;
  const expectedVideo = resolvePreviewVideo(expectedSegment);
  const apiUrl = `${PRODUCTION}/api/preview/${token}`;
  const pageUrl = `${PRODUCTION}/report/p/${token}`;
  const result = {
    domain: row.domain,
    token,
    api_status: 0,
    page_status: 0,
    api_video_segment: null,
    expected_video_segment: expectedSegment,
    video_segment_match: false,
    video_asset_match: false,
    company_match: false,
    industry_present: false,
    observations_ok: false,
    cta_ok: false,
    prefill_ok: false,
    preview_url_valid: false,
    leakage: [],
    pass: false,
    failures: [],
  };

  const api = await fetchStatus(apiUrl);
  result.api_status = api.status;
  if (!api.ok) {
    result.failures.push(`api_http_${api.status}`);
    return result;
  }

  let payload;
  try {
    payload = JSON.parse(api.text);
  } catch {
    result.failures.push('api_invalid_json');
    return result;
  }

  result.api_video_segment = payload.video_segment ?? null;
  result.video_segment_match = payload.video_segment === expectedSegment;
  const resolved = resolvePreviewVideo(payload.video_segment);
  result.video_asset_match = resolved.src.endsWith(expectedAsset);

  result.company_match = payload.company_name === row.company_name;
  result.industry_present = Boolean(payload.industry);
  result.observations_ok =
    Array.isArray(payload.observations) &&
    payload.observations.length >= 1 &&
    payload.observations.every((o) => o.code && o.copy && !o.raw);

  const page = await fetchStatus(pageUrl);
  result.page_status = page.status;
  if (!page.ok) {
    result.failures.push(`page_http_${page.status}`);
  } else {
    result.cta_ok =
      /レポートを見る|詳細レポート|report/i.test(page.text) &&
      (page.text.includes('/report/') || page.text.includes('handleEngage'));
    result.prefill_ok =
      page.text.includes('sessionStorage') &&
      page.text.includes('ari_preview_prefill');
    result.preview_url_valid = page.text.includes(token);
    const leaks = checkLeakage(page.text);
    result.leakage = leaks;
    if (leaks.length) result.failures.push(`leakage:${leaks.join(',')}`);
    if (!page.text.includes(expectedAsset.split('/').pop())) {
      result.failures.push(`page_missing_asset:${expectedAsset}`);
    }
    if (!page.text.includes(expectedVideo.src.split('/').pop())) {
      result.failures.push(`page_missing_video_src:${expectedVideo.src}`);
    }
  }

  if (!result.video_segment_match) result.failures.push('video_segment_mismatch');
  if (!result.video_asset_match) result.failures.push('video_asset_mismatch');
  if (!result.company_match) result.failures.push('company_mismatch');
  if (!result.industry_present) result.failures.push('industry_missing');
  if (!result.observations_ok) result.failures.push('observations_invalid');
  if (!result.cta_ok) result.failures.push('cta_missing');
  if (!result.prefill_ok) result.failures.push('prefill_missing');
  if (!result.preview_url_valid) result.failures.push('preview_token_not_in_page');

  result.pass =
    result.api_status === 200 &&
    result.page_status === 200 &&
    result.failures.length === 0;
  return result;
}

async function verifyReportCarousel() {
  const res = await fetchStatus(`${PRODUCTION}/report/`);
  const assets = [
    'scene-01-ai-search.mp4',
    'scene-02-compare.mov',
    'scene-03-recommend.mov',
    'scene-04-booking.mov',
    'scene-05-action.mov',
  ];
  const missing = assets.filter((a) => !res.text.includes(a));
  return {
    status: res.status,
    pass: res.ok && missing.length === 0 && /VideoCarousel|scene-videos/i.test(res.text),
    missing_assets: missing,
  };
}

async function main() {
  const rows = loadCanaryRows();
  const candidateResults = [];
  for (const row of rows) {
    candidateResults.push(await verifyCandidate(row));
  }

  const carousel = await verifyReportCarousel();

  const summary = {
    production_base: PRODUCTION,
    real_sends: 0,
    p1_verified: null,
    canary_api_pass: candidateResults.filter((r) => r.api_status === 200).length,
    canary_preview_pass: candidateResults.filter((r) => r.page_status === 200).length,
    canary_video_segment_pass: candidateResults.filter((r) => r.video_segment_match).length,
    canary_video_asset_pass: candidateResults.filter((r) => r.video_asset_match).length,
    canary_cta_prefill_pass: candidateResults.filter(
      (r) => r.cta_ok && r.prefill_ok,
    ).length,
    canary_full_pass: candidateResults.filter((r) => r.pass).length,
    video_segment_mismatch: candidateResults.filter((r) => !r.video_segment_match).length,
    production_api_video_gap: candidateResults.filter((r) => !r.api_video_segment).length,
    preview_failure: candidateResults.filter((r) => r.page_status !== 200 || !r.pass).length,
    report_video_regression: carousel.pass ? 'PASS' : 'FAIL',
    carousel,
    candidates: candidateResults,
  };

  const outPath = path.join(
    VAULT,
    '70_outputs/5-Day-Sales-Sprint/Canary-10-Production-E2E-2026-08-15.json',
  );
  fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nWrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
