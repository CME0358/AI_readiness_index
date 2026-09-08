import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PURCHASE_INTENT_QUESTIONS,
  questionsBySegment,
  assertNoBrandInQuestions,
} from '../lib/observation/purchase-intent-questions.mjs';
import { BRAND_MATCH_TERMS, SEGMENTS } from '../lib/observation/constants.mjs';
import { normalizeRecord, buildDefaultConditions } from '../lib/observation/ai-response-schema.mjs';
import { aggregateAiResponses } from '../lib/observation/ai-response-aggregator.mjs';
import {
  importGscQueries,
  importGa4Export,
  importBingQueries,
  importCrmExport,
} from '../lib/observation/channel-import.mjs';
import { buildWeeklyComparison, diffWeeklyReports } from '../lib/observation/weekly-baseline.mjs';

function baseRow(overrides = {}) {
  const q = PURCHASE_INTENT_QUESTIONS[0];
  return {
    record_id: 'r1',
    wave_id: '2026-W36',
    observation_mode: 'purchase_intent',
    question_id: q.id,
    question_text: q.text,
    segment: q.segment,
    target_ai: 'chatgpt',
    model_id: 'unknown',
    search_enabled: 'unknown',
    interface_type: 'ui',
    observed_at: '2026-09-08T10:00:00+09:00',
    locale: 'ja-JP',
    region: 'JP',
    conversation_state: 'new',
    repeat_count: '1',
    execution_status: 'success',
    error_code: '',
    mentions_brand_unprompted: 'false',
    recommends_vendor: 'true',
    vendor_names: 'Example Vendor',
    citation_urls: 'https://example.com/page',
    pricing_claim_accurate: 'n/a',
    pricing_claim_notes: '',
    has_consult_path: 'false',
    consult_path_notes: '',
    operator_notes: '',
    ...overrides,
  };
}

describe('ARI-P2-02 observation', () => {
  it('defines 12 purchase-intent questions (4 per segment)', () => {
    assert.equal(PURCHASE_INTENT_QUESTIONS.length, 12);
    for (const seg of Object.values(SEGMENTS)) {
      assert.equal(questionsBySegment(seg).length, 4);
    }
  });

  it('purchase-intent questions contain no brand terms', () => {
    const violations = assertNoBrandInQuestions(BRAND_MATCH_TERMS);
    assert.deepEqual(violations, []);
  });

  it('buildDefaultConditions sets fixed locale and platform defaults', () => {
    const cond = buildDefaultConditions({ questionId: 'ent-01', targetAi: 'perplexity' });
    assert.equal(cond.locale, 'ja-JP');
    assert.equal(cond.region, 'JP');
    assert.equal(cond.search_enabled, 'yes');
    assert.equal(cond.interface_type, 'ui');
  });

  it('normalizeRecord accepts valid success row', () => {
    const { record, errors } = normalizeRecord(baseRow());
    assert.equal(errors.length, 0);
    assert.equal(record.valid_for_denominator, true);
    assert.equal(record.vendor_names[0], 'Example Vendor');
  });

  it('aggregate uses success-only denominator; errors are separate', () => {
    const ok = normalizeRecord(baseRow({ record_id: 'ok', mentions_brand_unprompted: 'true' }));
    const err = normalizeRecord(baseRow({
      record_id: 'err',
      execution_status: 'error',
      error_code: 'timeout',
    }));
    const agg = aggregateAiResponses([ok, err]);
    assert.equal(agg.counts.valid_denominator, 1);
    assert.equal(agg.counts.errors, 1);
    assert.equal(agg.rates.brand_mention_rate, 1);
  });

  it('does not merge UI and API into one AI bucket', () => {
    const ui = normalizeRecord(baseRow({ record_id: 'ui', interface_type: 'ui' }));
    const api = normalizeRecord(baseRow({
      record_id: 'api',
      interface_type: 'api',
      target_ai: 'chatgpt',
    }));
    const agg = aggregateAiResponses([ui, api]);
    assert.equal(agg.by_ai_interface['chatgpt:ui'].denominator, 1);
    assert.equal(agg.by_ai_interface['chatgpt:api'].denominator, 1);
  });

  it('importGscQueries excludes branded queries', () => {
    const csv = `Query,Clicks,Impressions
agent readiness 診断,10,100
ai検索 対策,5,50`;
    const result = importGscQueries(csv, { brandTerms: ['agent readiness'] });
    assert.equal(result.non_branded_organic_clicks, 5);
    assert.equal(result.row_count, 1);
  });

  it('importGa4Export excludes preview hosts', () => {
    const csv = `Event name,Event count,Hostname
service_view,3,readiness.coaretail.com
service_view,9,foo.vercel.app`;
    const result = importGa4Export(csv);
    assert.equal(result.service_view_events, 3);
    assert.equal(result.excluded_non_production_rows, 1);
  });

  it('importBingQueries and importCrmExport parse manual exports', () => {
    const bing = importBingQueries('Query,Clicks,Impressions\ngeo 対策,2,20', { brandTerms: [] });
    assert.equal(bing.non_branded_organic_clicks, 2);
    const crm = importCrmExport('lead_id,stage\n1,inquiry\n2,consult');
    assert.equal(crm.inquiry_count, 1);
    assert.equal(crm.consult_count, 1);
  });

  it('weekly comparison separates channels and flags missing baseline', () => {
    const gsc = importGscQueries('Query,Clicks,Impressions\nai seo,1,10', { brandTerms: [] });
    const report = buildWeeklyComparison({
      waveId: '2026-W36',
      weekStart: '2026-09-01',
      weekEnd: '2026-09-07',
      aiRecords: [],
      channelImports: [gsc],
    });
    assert.equal(report.metrics.non_branded_organic_clicks, 1);
    assert.equal(report.baseline_status.ai_observation, 'pending');
    assert.equal(report.baseline_status.gsc, 'imported');
    assert.equal(report.baseline_status.ga4, 'missing');
  });

  it('weekly diff computes metric deltas', () => {
    const prev = {
      wave_id: '2026-W35',
      metrics: { non_branded_organic_clicks: 10, inquiry_count: 2 },
    };
    const cur = {
      wave_id: '2026-W36',
      metrics: { non_branded_organic_clicks: 15, inquiry_count: 2 },
      ai_aggregate: { denominator: 0 },
    };
    const diff = diffWeeklyReports(cur, prev);
    assert.equal(diff.deltas.non_branded_organic_clicks.delta, 5);
  });
});
