import { mergeChannelImports } from './channel-import.mjs';
import { WEEKLY_METRIC_KEYS } from './constants.mjs';
import { aggregateAiResponses } from './ai-response-aggregator.mjs';

/**
 * Weekly comparison separates:
 * - non-branded organic (GSC/Bing)
 * - AI citations (from observation records)
 * - AI referral sessions (GA4)
 * - service views (GA4)
 * - inquiry / consult / order (CRM)
 *
 * Dedupe rules (documented, applied when flags provided):
 * - exclude_test_traffic: drop GA4 rows on non-prod hosts (handled in importGa4Export)
 * - dedupe_self_reported_ai: if lead has awareness_channel=AI and first_ai_touch same week, count inquiry once
 */
export function buildWeeklyComparison({
  waveId,
  weekStart,
  weekEnd,
  aiRecords = [],
  channelImports = [],
  aiAggregate = null,
  crmRows = [],
}) {
  const channels = mergeChannelImports(channelImports);
  const ai = aiAggregate ?? aggregateAiResponses(aiRecords);

  const citationCount = (aiRecords.length ? aiRecords : [])
    .filter((item) => (item.record ?? item).execution_status === 'success')
    .reduce((sum, item) => {
      const r = item.record ?? item;
      return sum + (r.citation_urls?.length || 0);
    }, 0);

  channels.ai_citation_count = citationCount;

  let inquiryDeduped = channels.inquiry_count;
  let dedupeRemoved = 0;

  if (crmRows.length) {
    const seen = new Set();
    for (const row of crmRows) {
      const id = row.lead_id || row.id;
      const awareness = String(row.awareness_channel || row.awareness || '').toUpperCase();
      const firstAi = String(row.first_ai_touch || row.first_touch || '').toUpperCase();
      if (awareness === 'AI' && firstAi === 'AI' && id) {
        if (seen.has(id)) dedupeRemoved += 1;
        else seen.add(id);
      }
    }
    inquiryDeduped = Math.max(0, channels.inquiry_count - dedupeRemoved);
  }

  const metrics = {};
  for (const key of WEEKLY_METRIC_KEYS) {
    metrics[key] = channels[key] ?? 0;
  }
  metrics.inquiry_count_deduped = inquiryDeduped;
  metrics.inquiry_self_report_dedupe_removed = dedupeRemoved;

  const baselineStatus = {
    ai_observation: ai.counts.valid_denominator > 0 ? 'established' : 'pending',
    gsc: channelImports.some((p) => p.source === 'gsc_export') ? 'imported' : 'missing',
    ga4: channelImports.some((p) => p.source === 'ga4_export') ? 'imported' : 'missing',
    bing: channelImports.some((p) => p.source === 'bing_export') ? 'imported' : 'missing',
    crm: channelImports.some((p) => p.source === 'crm_export') ? 'imported' : 'missing',
  };

  return {
    schema: 'weekly_observation_v1',
    wave_id: waveId,
    week_start: weekStart,
    week_end: weekEnd,
    metrics,
    ai_aggregate: {
      denominator: ai.counts.valid_denominator,
      errors: ai.counts.errors,
      brand_mention_rate: ai.rates.brand_mention_rate,
      vendor_recommend_rate: ai.rates.vendor_recommend_rate,
    },
    baseline_status: baselineStatus,
    notes: [
      'UI and API AI observations are not pooled — see ai_aggregate.by_ai_interface.',
      'Mock or sample data must not be published as production metrics.',
      'Observation period must elapse before treating rate changes as outcomes.',
    ],
  };
}

export function diffWeeklyReports(current, previous) {
  if (!previous) {
    return { schema: 'weekly_diff_v1', has_previous: false, deltas: {} };
  }

  const deltas = {};
  for (const key of WEEKLY_METRIC_KEYS) {
    const cur = current.metrics?.[key] ?? 0;
    const prev = previous.metrics?.[key] ?? 0;
    deltas[key] = { current: cur, previous: prev, delta: cur - prev };
  }

  return {
    schema: 'weekly_diff_v1',
    has_previous: true,
    wave_current: current.wave_id,
    wave_previous: previous.wave_id,
    deltas,
    ai_denominator_delta: (current.ai_aggregate?.denominator ?? 0) - (previous.ai_aggregate?.denominator ?? 0),
  };
}
