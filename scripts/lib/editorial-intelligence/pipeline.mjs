import fs from 'node:fs';
import path from 'node:path';
import { INTELLIGENCE_PATHS, ROOT } from './paths.mjs';
import { loadSourcesRegistry, saveSourcesRegistry, listEnabledSources, updateSourceHealth } from './sources.mjs';
import { fetchFeed, parseFeedItems, loadBackfillFixtures } from './fetcher.mjs';
import { dedupeItemsToEvents, countDuplicateMerges } from './dedupe.mjs';
import {
  scoreEvent,
  priorityFromScore,
  effectivePriority,
  freshnessMultiplier,
} from './scoring.mjs';
import { classifyCannibalization, buildInterpretation } from './cannibalization.mjs';
import { buildClaimMap, validateClaims, validateDraftText } from './citation-validator.mjs';
import { buildSeoPackage, generateArticleDraft } from './draft-generator.mjs';
import {
  loadEvents,
  saveEvents,
  loadQueue,
  saveQueue,
  upsertQueueEntry,
  buildBreakingAlert,
  filterQueueByPriority,
} from './storage.mjs';
import { proposeScheduleChange, getNextAvailableSlot } from './schedule-proposal.mjs';
import { blockIfAbis } from './abis-guard.mjs';
import { SOURCE_LEVEL, EVENT_STATUSES, SCORE_THRESHOLDS, PRIORITY_BANDS } from './constants.mjs';
import { PATHS } from '../insights-v2-paths.mjs';
import { generateDailyBrief } from './daily-brief.mjs';
import { processAbisImpactWatch, writePrivateDailyBrief } from '../abis-intelligence/pipeline-bridge.mjs';

export async function fetchAllSources({ useBackfill = false, dryRun = true } = {}) {
  const registry = loadSourcesRegistry();
  const allItems = [];

  if (useBackfill) {
    const fixtures = loadBackfillFixtures(INTELLIGENCE_PATHS.fixtures);
    allItems.push(...fixtures);
    return { registry, items: allItems, errors: [] };
  }

  const errors = [];
  for (const source of listEnabledSources(registry)) {
    const feedUrl = source.feed_url || source.url;
    if (!feedUrl) continue;
    const result = await fetchFeed(feedUrl);
    const idx = registry.sources.findIndex((s) => s.source_id === source.source_id);
    if (!result.ok) {
      errors.push({ source_id: source.source_id, error: result.error });
      registry.sources[idx] = updateSourceHealth(source, { success: false, error: result.error });
      continue;
    }
    const items = parseFeedItems(result.text, {
      company: source.company,
      sourceId: source.source_id,
      sourceType: source.source_type,
      sourceLevel: source.priority === 'A' ? 'A' : 'B',
    });
    allItems.push(...items);
    const latest = items[0]?.published_date || null;
    registry.sources[idx] = updateSourceHealth(source, {
      success: true,
      latestItemDate: latest,
    });
    if (items[0]) registry.sources[idx].last_seen_item = items[0].item_id;
  }
  if (!dryRun) saveSourcesRegistry(registry);
  return { registry, items: allItems, errors };
}

export function processPipeline({
  items,
  dryRun = true,
  now = new Date(),
} = {}) {
  const rawCount = items.length;
  const events = dedupeItemsToEvents(items);
  const duplicates = countDuplicateMerges(rawCount, events.length);
  const schedule = JSON.parse(fs.readFileSync(PATHS.schedule, 'utf8'));

  const processed = [];
  const ignored = [];
  const alerts = [];
  const blocked = [];
  const ariStatusByEventId = new Map();

  for (const event of events) {
    const abis = blockIfAbis(event);
    if (abis.blocked) {
      blocked.push({ event_id: event.event_id, reason: abis.reason });
      event.status = EVENT_STATUSES.IGNORE;
      ariStatusByEventId.set(event.event_id, `BLOCKED:${abis.reason}`);
      continue;
    }

    const scoring = scoreEvent(event, { now });
    event.score = scoring.score;
    event.score_breakdown = scoring.breakdown;
    event.ari_layers = scoring.ari_layers;
    event.status = EVENT_STATUSES.SCORED;
    event.base_priority = priorityFromScore(scoring.score);
    event.priority = effectivePriority(event.base_priority, event.published_date, now);
    event.freshness = freshnessMultiplier(event.published_date, now);

    if (scoring.score < SCORE_THRESHOLDS.MONITOR_MIN) {
      event.status = EVENT_STATUSES.IGNORE;
      ignored.push(event);
      ariStatusByEventId.set(event.event_id, event.status);
      continue;
    }

    const cannibalization = classifyCannibalization(event, { root: ROOT });
    event.article_type = cannibalization.article_type;
    event.cannibalization = cannibalization;

    if (scoring.score < SCORE_THRESHOLDS.DRAFT_MIN) {
      event.status = EVENT_STATUSES.IGNORE;
      ignored.push(event);
      ariStatusByEventId.set(event.event_id, event.status);
      continue;
    }

    const interpretation = buildInterpretation(event, scoring);
    const claims = buildClaimMap(event);
    const claimValidation = validateClaims(claims);
    if (!claimValidation.ok) {
      blocked.push({ event_id: event.event_id, reason: 'CITATION_BLOCKED', issues: claimValidation.blocked });
      ariStatusByEventId.set(event.event_id, 'BLOCKED:CITATION');
      continue;
    }

    const seo = buildSeoPackage(event, interpretation);
    const draftBody = generateArticleDraft(event, scoring, interpretation, cannibalization, seo);
    const draftValidation = validateDraftText(draftBody);
    if (!draftValidation.ok) {
      blocked.push({ event_id: event.event_id, reason: 'DRAFT_VALIDATION', issues: draftValidation.issues });
      ariStatusByEventId.set(event.event_id, 'BLOCKED:DRAFT_VALIDATION');
      continue;
    }

    event.status = EVENT_STATUSES.READY_FOR_EDITORIAL_REVIEW;
    event.slug_proposal = seo.slug_proposal;
    event.canonical_conflict = cannibalization.conflict_slug;
    event.claims = claims;
    event.schedule_proposal = proposeScheduleChange(
      { ...event, slug_proposal: seo.slug_proposal },
      schedule,
      { now },
    );

    const draftPath = path.join(INTELLIGENCE_PATHS.draftsDir, `${event.event_id}.md`);
    fs.mkdirSync(INTELLIGENCE_PATHS.draftsDir, { recursive: true });
    fs.writeFileSync(draftPath, draftBody);
    event.draft_path = draftPath;

    processed.push(event);
    ariStatusByEventId.set(event.event_id, event.status);

    if ([PRIORITY_BANDS.P0, PRIORITY_BANDS.P1].includes(event.priority)) {
      alerts.push(buildBreakingAlert(event));
    }
  }

  let queue = loadQueue();
  for (const ev of processed) {
    queue = upsertQueueEntry(queue, ev);
  }

  const eventStore = loadEvents();
  eventStore.events = [...events];

  saveEvents(eventStore);
  saveQueue(queue);

  const brief = generateDailyBrief({
    alerts,
    queue,
    ignored,
    processed,
    blocked,
    registry: loadSourcesRegistry(),
    slot: getNextAvailableSlot(schedule, { now }),
    dryRun,
  });

  fs.mkdirSync(path.dirname(INTELLIGENCE_PATHS.dailyBrief), { recursive: true });
  fs.writeFileSync(INTELLIGENCE_PATHS.dailyBrief, brief);

  return {
    rawCount,
    duplicates,
    eventCount: events.length,
    allEvents: events,
    ariStatusByEventId,
    processed,
    ignored,
    blocked,
    alerts,
    queue,
    p0: filterQueueByPriority(queue, PRIORITY_BANDS.P0),
    p1: filterQueueByPriority(queue, PRIORITY_BANDS.P1),
    p2: filterQueueByPriority(queue, PRIORITY_BANDS.P2),
    dryRun,
    scheduleMutation: false,
  };
}

export async function runIntelligencePipeline(options = {}) {
  const dryRun = options.dryRun !== false;
  const useBackfill = options.backfill === true;
  const abisNotify = options.abisNotify === true;
  const fetchResult = await fetchAllSources({ useBackfill, dryRun });
  const now =
    options.now ||
    (useBackfill ? new Date('2026-08-09T12:00:00.000Z') : new Date());
  const pipelineResult = processPipeline({ items: fetchResult.items, dryRun, now });

  const abisWatch = await processAbisImpactWatch(pipelineResult.allEvents, {
    dryRun,
    notify: abisNotify,
    ariStatusByEventId: pipelineResult.ariStatusByEventId,
  });

  writePrivateDailyBrief(abisWatch.abisBriefSection, {
    editorialBriefPath: INTELLIGENCE_PATHS.dailyBrief,
  });

  return {
    ...pipelineResult,
    fetchErrors: fetchResult.errors,
    abisWatch,
  };
}
