import { AI_PLATFORMS, SEGMENTS } from './constants.mjs';
import { PURCHASE_INTENT_QUESTIONS } from './purchase-intent-questions.mjs';

function inc(map, key, by = 1) {
  map.set(key, (map.get(key) || 0) + by);
}

function rate(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

/**
 * Aggregate AI response records.
 * Denominator = execution_status === success only. Errors/blocked are separate buckets.
 * UI and API are never merged — group keys include interface_type.
 */
export function aggregateAiResponses(records) {
  const valid = [];
  const errors = [];
  const blocked = [];
  const skipped = [];
  const parseErrors = [];

  for (const item of records) {
    if (item.errors?.length) {
      parseErrors.push(item);
      continue;
    }
    const r = item.record ?? item;
    switch (r.execution_status) {
      case 'success':
        valid.push(r);
        break;
      case 'error':
        errors.push(r);
        break;
      case 'blocked':
        blocked.push(r);
        break;
      case 'skipped':
        skipped.push(r);
        break;
      default:
        parseErrors.push({ record: r, errors: ['invalid execution_status'] });
    }
  }

  const denominator = valid.length;

  const byQuestion = new Map();
  const byAi = new Map();
  const bySegment = new Map();
  const byInterface = new Map();
  const byAiInterface = new Map();

  let brandMentions = 0;
  let vendorRecommends = 0;
  let consultPaths = 0;
  let pricingInaccurate = 0;
  let pricingEvaluated = 0;
  const citationHosts = new Map();
  const vendorNameCounts = new Map();

  for (const r of valid) {
    inc(byQuestion, r.question_id);
    inc(byAi, r.target_ai);
    inc(bySegment, r.segment);
    inc(byInterface, r.interface_type);
    inc(byAiInterface, `${r.target_ai}:${r.interface_type}`);

    if (r.mentions_brand_unprompted) brandMentions += 1;
    if (r.recommends_vendor) vendorRecommends += 1;
    if (r.has_consult_path) consultPaths += 1;

    if (r.pricing_claim_accurate === 'yes' || r.pricing_claim_accurate === 'no') {
      pricingEvaluated += 1;
      if (r.pricing_claim_accurate === 'no') pricingInaccurate += 1;
    }

    for (const url of r.citation_urls || []) {
      try {
        const host = new URL(url).hostname.replace(/^www\./, '');
        inc(citationHosts, host);
      } catch {
        inc(citationHosts, 'invalid_url');
      }
    }

    for (const name of r.vendor_names || []) {
      inc(vendorNameCounts, name);
    }
  }

  const segmentRates = {};
  for (const seg of Object.values(SEGMENTS)) {
    const segValid = valid.filter((r) => r.segment === seg);
    const d = segValid.length;
    segmentRates[seg] = {
      denominator: d,
      brand_mention_rate: rate(segValid.filter((r) => r.mentions_brand_unprompted).length, d),
      vendor_recommend_rate: rate(segValid.filter((r) => r.recommends_vendor).length, d),
      consult_path_rate: rate(segValid.filter((r) => r.has_consult_path).length, d),
    };
  }

  const aiRates = {};
  for (const [aiId, meta] of Object.entries(AI_PLATFORMS)) {
    for (const iface of ['ui', 'api']) {
      const subset = valid.filter((r) => r.target_ai === aiId && r.interface_type === iface);
      const d = subset.length;
      aiRates[`${aiId}:${iface}`] = {
        label: `${meta.label} (${iface})`,
        condition_notes: meta.conditionNotes,
        denominator: d,
        brand_mention_rate: rate(subset.filter((r) => r.mentions_brand_unprompted).length, d),
        vendor_recommend_rate: rate(subset.filter((r) => r.recommends_vendor).length, d),
        consult_path_rate: rate(subset.filter((r) => r.has_consult_path).length, d),
      };
    }
  }

  const questionRates = PURCHASE_INTENT_QUESTIONS.map((q) => {
    const subset = valid.filter((r) => r.question_id === q.id);
    const d = subset.length;
    return {
      question_id: q.id,
      segment: q.segment,
      denominator: d,
      brand_mention_rate: rate(subset.filter((r) => r.mentions_brand_unprompted).length, d),
      vendor_recommend_rate: rate(subset.filter((r) => r.recommends_vendor).length, d),
      consult_path_rate: rate(subset.filter((r) => r.has_consult_path).length, d),
    };
  });

  return {
    schema: 'ai_response_aggregate_v1',
    counts: {
      valid_denominator: denominator,
      errors: errors.length,
      blocked: blocked.length,
      skipped: skipped.length,
      parse_errors: parseErrors.length,
    },
    rates: {
      brand_mention_rate: rate(brandMentions, denominator),
      vendor_recommend_rate: rate(vendorRecommends, denominator),
      consult_path_rate: rate(consultPaths, denominator),
      pricing_inaccuracy_rate: rate(pricingInaccurate, pricingEvaluated),
      pricing_evaluated_count: pricingEvaluated,
    },
    by_segment: segmentRates,
    by_ai_interface: aiRates,
    by_question: questionRates,
    top_citation_hosts: [...citationHosts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([host, count]) => ({ host, count })),
    top_vendor_names: [...vendorNameCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => ({ name, count })),
    warnings: denominator === 0 ? ['No valid success responses — baseline not established'] : [],
  };
}
