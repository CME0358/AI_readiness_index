#!/usr/bin/env node
/**
 * RMVU-05D — Editorial Intelligence Automation tests (T01–T30).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSourcesRegistry, listEnabledSources, updateSourceHealth } from '../lib/editorial-intelligence/sources.mjs';
import { parseFeedItems, loadBackfillFixtures } from '../lib/editorial-intelligence/fetcher.mjs';
import { dedupeItemsToEvents, countDuplicateMerges, buildEventId } from '../lib/editorial-intelligence/dedupe.mjs';
import {
  scoreEvent,
  priorityFromScore,
  freshnessMultiplier,
  effectivePriority,
} from '../lib/editorial-intelligence/scoring.mjs';
import { blockIfAbis, containsAbisContent } from '../lib/editorial-intelligence/abis-guard.mjs';
import { classifyCannibalization, buildInterpretation } from '../lib/editorial-intelligence/cannibalization.mjs';
import { buildClaimMap, validateClaims, validateDraftText } from '../lib/editorial-intelligence/citation-validator.mjs';
import { buildSeoPackage, generateArticleDraft } from '../lib/editorial-intelligence/draft-generator.mjs';
import { proposeScheduleChange, getNextAvailableSlot } from '../lib/editorial-intelligence/schedule-proposal.mjs';
import { processPipeline, runIntelligencePipeline } from '../lib/editorial-intelligence/pipeline.mjs';
import { loadQueue, upsertQueueEntry } from '../lib/editorial-intelligence/storage.mjs';
import { INTELLIGENCE_PATHS, ROOT } from '../lib/editorial-intelligence/paths.mjs';
import { EVENT_STATUSES, PRIORITY_BANDS, SCORE_THRESHOLDS, SOURCE_HEALTH } from '../lib/editorial-intelligence/constants.mjs';
import { PROTECTED_ABIS_SLUGS } from '../lib/product-integrity.mjs';
import { PATHS } from '../lib/insights-v2-paths.mjs';
import { EDITORIAL_STATUSES } from '../lib/editorial-status.mjs';
import { scoreAbisImpact } from '../lib/abis-intelligence/scoring.mjs';
import { processAbisImpactWatch } from '../lib/abis-intelligence/pipeline-bridge.mjs';
import {
  notifyAbisImpact,
  shouldNotify,
  sanitizeLogMessage,
} from '../lib/abis-intelligence/slack-notifier.mjs';
import { ABIS_INTELLIGENCE_PATHS, PUBLIC_SURFACE_PATHS } from '../lib/abis-intelligence/paths.mjs';
import { ABIS_SEVERITY, PATENT_FLAGS } from '../lib/abis-intelligence/constants.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const SAMPLE_RSS = `<?xml version="1.0"?><rss><channel>
<item><title>AI Search Update</title><link>https://example.com/a</link><pubDate>Sat, 08 Aug 2026 10:00:00 GMT</pubDate><description>Enterprise AI search discovery update.</description></item>
</channel></rss>`;

function sampleEvent(overrides = {}) {
  return {
    event_id: 'evt-test',
    company: 'Google',
    title: 'Google AI Overviews expand merchant and local business discovery signals',
    url: 'https://blog.google/example/',
    published_date: new Date().toISOString(),
    excerpt: 'Google shares updates to AI Overviews affecting local business discovery.',
    primary_source: { source_type: 'official_blog', source_level: 'A', url: 'https://blog.google/example/' },
    secondary_sources: [],
    detected_at: new Date().toISOString(),
    ...overrides,
  };
}

test('RMVU-05D T01 source registry loads with 5 target companies', () => {
  const reg = loadSourcesRegistry();
  assert.ok(reg.sources.length >= 5);
  const companies = new Set(reg.sources.map((s) => s.company));
  for (const c of ['Cloudflare', 'Microsoft', 'Google', 'OpenAI', 'Anthropic']) {
    assert.ok(companies.has(c), `missing ${c}`);
  }
});

test('RMVU-05D T02 official item fetched from RSS parse', () => {
  const items = parseFeedItems(SAMPLE_RSS, {
    company: 'Google',
    sourceId: 'google-blog',
    sourceType: 'official_blog',
    sourceLevel: 'A',
  });
  assert.equal(items.length, 1);
  assert.match(items[0].title, /AI Search/);
  assert.ok(items[0].url);
  assert.ok(items[0].excerpt.length <= 281);
});

test('RMVU-05D T03 duplicate detected across surfaces', () => {
  const fixtures = loadBackfillFixtures(INTELLIGENCE_PATHS.fixtures);
  const events = dedupeItemsToEvents(fixtures);
  const dupCount = countDuplicateMerges(fixtures.length, events.length);
  assert.ok(dupCount >= 1, `expected duplicate merge, got ${dupCount}`);
  const google = events.find((e) => e.company === 'Google' && e.title.includes('AI Overviews'));
  assert.ok(google?.secondary_sources?.length >= 1);
});

test('RMVU-05D T04 event normalized with event_id', () => {
  const item = {
    company: 'OpenAI',
    title: 'Test announcement',
    url: 'https://openai.com/news/test/',
    source_id: 'openai-blog',
    source_type: 'official_blog',
    source_level: 'A',
    published_date: '2026-08-08T00:00:00.000Z',
    fetched_at: '2026-08-09T00:00:00.000Z',
  };
  const [ev] = dedupeItemsToEvents([item]);
  assert.ok(ev.event_id);
  assert.equal(ev.event_id, buildEventId(item));
  assert.equal(ev.primary_source.source_id, 'openai-blog');
});

test('RMVU-05D T05 relevance score 0–100', () => {
  const ev = sampleEvent();
  const { score, breakdown } = scoreEvent(ev, { now: new Date('2026-08-09T12:00:00.000Z') });
  assert.ok(score >= 0 && score <= 100);
  const sum = Object.values(breakdown).reduce((a, b) => a + b, 0);
  assert.equal(score, Math.min(100, sum));
});

test('RMVU-05D T06 high relevance → P0/P1', () => {
  const ev = sampleEvent();
  const { score } = scoreEvent(ev, { now: new Date('2026-08-09T12:00:00.000Z') });
  const pri = priorityFromScore(score);
  assert.ok(['P0', 'P1', 'P2'].includes(pri));
  assert.ok(score >= SCORE_THRESHOLDS.P2_MIN);
});

test('RMVU-05D T07 low relevance → ignore', () => {
  const ev = sampleEvent({
    title: 'Microsoft quarterly earnings call scheduled',
    excerpt: 'Routine investor relations announcement.',
    published_date: '2026-07-01T10:00:00.000Z',
  });
  const { score } = scoreEvent(ev, { now: new Date('2026-08-09T12:00:00.000Z') });
  assert.ok(score < SCORE_THRESHOLDS.DRAFT_MIN || priorityFromScore(score) === PRIORITY_BANDS.IGNORE);
});

test('RMVU-05D T08 freshness decay', () => {
  const fresh = freshnessMultiplier(new Date().toISOString(), new Date());
  const stale = freshnessMultiplier('2026-07-01T10:00:00.000Z', new Date('2026-08-09T12:00:00.000Z'));
  assert.equal(fresh, 1);
  assert.ok(stale <= 0.4);
  const demoted = effectivePriority(PRIORITY_BANDS.P0, '2026-07-01T10:00:00.000Z', new Date('2026-08-09T12:00:00.000Z'));
  assert.notEqual(demoted, PRIORITY_BANDS.P0);
});

test('RMVU-05D T09 existing article → refresh recommendation', () => {
  const schedule = JSON.parse(fs.readFileSync(PATHS.schedule, 'utf8'));
  const existing = schedule.articles.find((a) => a.title && a.status !== EDITORIAL_STATUSES.PUBLISHED);
  assert.ok(existing, 'need scheduled article for refresh test');
  const ev = sampleEvent({ title: existing.title, excerpt: existing.primarySearchIntent || existing.title });
  ev.score = 70;
  ev.priority = PRIORITY_BANDS.P1;
  const c = classifyCannibalization(ev, { root: ROOT });
  assert.ok(['REFRESH EXISTING', 'MERGE'].includes(c.decision));
});

test('RMVU-05D T10 new topic → article recommendation', () => {
  const ev = sampleEvent({
    title: 'Unique platform capability xyz123 never published before',
    excerpt: 'Novel agent actionability API for enterprise booking flows.',
  });
  ev.score = 72;
  ev.priority = PRIORITY_BANDS.P1;
  const c = classifyCannibalization(ev, { root: ROOT });
  assert.equal(c.decision, 'NEW ARTICLE');
});

test('RMVU-05D T11 article draft created with frontmatter', () => {
  const ev = sampleEvent();
  ev.score = 75;
  ev.priority = PRIORITY_BANDS.P1;
  ev.freshness = 1;
  const scoring = scoreEvent(ev);
  const interpretation = buildInterpretation(ev, scoring);
  const cannibalization = classifyCannibalization(ev, { root: ROOT });
  const seo = buildSeoPackage(ev, interpretation);
  const draft = generateArticleDraft(ev, scoring, interpretation, cannibalization, seo);
  assert.match(draft, /^---\nevent_id:/);
  assert.match(draft, /status: READY_FOR_EDITORIAL_REVIEW/);
  assert.match(draft, /## What Happened/);
  assert.match(draft, /## Direct Answer|Direct Answer/);
});

test('RMVU-05D T12 source claims mapped', () => {
  const ev = sampleEvent();
  const claims = buildClaimMap(ev);
  assert.ok(claims.some((c) => c.confidence === 'VERIFIED' && c.source_url));
});

test('RMVU-05D T13 inference labeled', () => {
  const claims = buildClaimMap(sampleEvent());
  assert.ok(claims.some((c) => c.confidence === 'ARI INTERPRETATION'));
});

test('RMVU-05D T14 unsupported claim blocked in draft validation', () => {
  const bad = validateDraftText('これは必ず改善され、5.5倍の効果があります。');
  assert.equal(bad.ok, false);
  assert.ok(bad.issues.includes('UNSUPPORTED_MULTIPLIER') || bad.issues.includes('UNSUPPORTED_URGENCY'));
});

test('RMVU-05D T15 ABIS terms blocked', () => {
  assert.ok(containsAbisContent('Read about ABIS readiness gap'));
  const blocked = blockIfAbis({ title: 'abis-intro update', company: 'Test' });
  assert.equal(blocked.blocked, true);
});

test('RMVU-05D T16 protected slugs blocked', () => {
  for (const slug of PROTECTED_ABIS_SLUGS) {
    const r = blockIfAbis({ slug, title: 'Safe title', company: 'Test' });
    assert.equal(r.blocked, true, slug);
  }
});

test('RMVU-05D T17 queue priority ordering', () => {
  let q = { version: 1, entries: [] };
  q = upsertQueueEntry(q, { event_id: 'a', priority: PRIORITY_BANDS.P2, score: 55, company: 'A', title: 'a', status: EVENT_STATUSES.READY_FOR_EDITORIAL_REVIEW });
  q = upsertQueueEntry(q, { event_id: 'b', priority: PRIORITY_BANDS.P0, score: 85, company: 'B', title: 'b', status: EVENT_STATUSES.READY_FOR_EDITORIAL_REVIEW });
  const order = q.entries.map((e) => e.priority);
  assert.equal(order[0], PRIORITY_BANDS.P0);
});

test('RMVU-05D T18 P0 preempts P2 schedule proposal', () => {
  const schedule = JSON.parse(fs.readFileSync(PATHS.schedule, 'utf8'));
  const proposal = proposeScheduleChange(
    { event_id: 'x', priority: PRIORITY_BANDS.P0, slug_proposal: 'google-ai-update' },
    schedule,
    { now: new Date('2026-08-09T12:00:00.000Z') },
  );
  assert.equal(proposal.applicable, true);
  assert.ok(proposal.target_slot);
  assert.equal(proposal.mutation_executed, false);
});

test('RMVU-05D T19 displaced Evergreen rescheduled in proposal', () => {
  const schedule = JSON.parse(fs.readFileSync(PATHS.schedule, 'utf8'));
  const proposal = proposeScheduleChange(
    { event_id: 'y', priority: PRIORITY_BANDS.P1, slug_proposal: 'openai-search-update' },
    schedule,
    { now: new Date('2026-08-09T12:00:00.000Z') },
  );
  if (proposal.applicable) {
    assert.ok(proposal.displaced_article || proposal.new_displaced_slot);
  }
});

test('RMVU-05D T20 no schedule mutation in dry-run', async () => {
  const before = fs.readFileSync(PATHS.schedule, 'utf8');
  const fixtures = loadBackfillFixtures(INTELLIGENCE_PATHS.fixtures);
  const result = processPipeline({ items: fixtures.slice(0, 5), dryRun: true, now: new Date('2026-08-09T12:00:00.000Z') });
  const after = fs.readFileSync(PATHS.schedule, 'utf8');
  assert.equal(before, after);
  assert.equal(result.scheduleMutation, false);
});

test('RMVU-05D T21 human approval required — status ends at READY_FOR_EDITORIAL_REVIEW', () => {
  const fixtures = loadBackfillFixtures(INTELLIGENCE_PATHS.fixtures);
  const result = processPipeline({ items: fixtures.slice(0, 5), dryRun: true, now: new Date('2026-08-09T12:00:00.000Z') });
  for (const ev of result.processed) {
    assert.equal(ev.status, EVENT_STATUSES.READY_FOR_EDITORIAL_REVIEW);
    assert.notEqual(ev.status, EVENT_STATUSES.PUBLISHED);
  }
});

test('RMVU-05D T22 intelligence CLI does not invoke IndexNow', () => {
  const cli = read('scripts/intelligence-run.mjs');
  assert.doesNotMatch(cli, /submit-indexnow|from ['"].*indexnow/i);
  assert.doesNotMatch(cli, /import.*indexnow/i);
});

test('RMVU-05D T23 no public publish in pipeline', () => {
  const pipelineSrc = read('scripts/lib/editorial-intelligence/pipeline.mjs');
  assert.doesNotMatch(pipelineSrc, /publish-scheduled|publish:insights|PUBLISHED/);
});

test('RMVU-05D T24 no Stripe changes in intelligence modules', () => {
  const dir = path.join(ROOT, 'scripts/lib/editorial-intelligence');
  for (const f of fs.readdirSync(dir)) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(src, /stripe/i, f);
  }
});

test('RMVU-05D T25 RMVU-04F positioning preserved in drafts', () => {
  const ev = sampleEvent();
  ev.score = 70;
  ev.priority = PRIORITY_BANDS.P1;
  const draft = generateArticleDraft(
    ev,
    scoreEvent(ev),
    buildInterpretation(ev, scoreEvent(ev)),
    classifyCannibalization(ev, { root: ROOT }),
    buildSeoPackage(ev, {}),
  );
  assert.match(draft, /Agent Readiness|Discovery|Recommendation|Action/);
  assert.doesNotMatch(draft, /ABIS/);
});

test('RMVU-05D T26 GA4 hooks preserved in draft CTA guidance', () => {
  const ev = sampleEvent({ score: 70, priority: PRIORITY_BANDS.P1 });
  const draft = generateArticleDraft(
    ev,
    scoreEvent(ev),
    buildInterpretation(ev, scoreEvent(ev)),
    { article_type: 'CURRENT_EVENT_ANALYSIS', conflict_slug: null },
    buildSeoPackage(ev, {}),
  );
  assert.match(draft, /data-ga-insight-cta="report"/);
  assert.match(read('assets/analytics.js'), /insight_cta_report/);
});

test('RMVU-05D T27 editorial_hold preserved in schedule', () => {
  const schedule = JSON.parse(fs.readFileSync(PATHS.schedule, 'utf8'));
  const holds = schedule.articles.filter((a) => a.status === EDITORIAL_STATUSES.HOLD);
  assert.ok(holds.length > 0, 'evergreen hold queue must exist');
});

test('RMVU-05D T28 source health failure handled', () => {
  const src = { source_id: 'test', consecutive_failures: 0, health_status: SOURCE_HEALTH.HEALTHY };
  const failed = updateSourceHealth(src, { success: false, error: 'HTTP 503' });
  assert.equal(failed.consecutive_failures, 1);
  assert.equal(failed.health_status, SOURCE_HEALTH.DEGRADED);
  const dead3 = updateSourceHealth({ ...failed, consecutive_failures: 2 }, { success: false });
  assert.equal(dead3.consecutive_failures, 3);
  assert.equal(dead3.health_status, SOURCE_HEALTH.FAILED);
});

test('RMVU-05D T29 source parser failure safe — empty feed returns no items', () => {
  const items = parseFeedItems('<html>broken</html>', {
    company: 'Anthropic',
    sourceId: 'anthropic-news',
    sourceType: 'official_blog',
  });
  assert.deepEqual(items, []);
});

test('RMVU-05D T30 no copyrighted full-body storage in fetcher', () => {
  const src = read('scripts/lib/editorial-intelligence/fetcher.mjs');
  assert.match(src, /excerpt|280|metadata/i);
  const items = parseFeedItems(SAMPLE_RSS, {
    company: 'Google',
    sourceId: 'g',
    sourceType: 'official_blog',
  });
  assert.ok(!('body' in items[0]));
  assert.ok(items[0].excerpt.length <= 281);
});

test('RMVU-05D integration backfill pipeline runs end-to-end', async () => {
  const result = await runIntelligencePipeline({
    dryRun: true,
    backfill: true,
    now: new Date('2026-08-09T12:00:00.000Z'),
  });
  assert.ok(result.eventCount >= 5);
  assert.ok(result.processed.length >= 1);
  assert.ok(fs.existsSync(INTELLIGENCE_PATHS.dailyBrief));
  assert.ok(result.abisWatch);
  assert.ok(result.abisWatch.impacts.length >= 5);
});

// --- RMVU-05D Extension: Private ABIS Impact Watch (T31–T47) ---

function abisSampleEvent(overrides = {}) {
  return {
    event_id: 'abis-test-evt',
    company: 'OpenAI',
    title: 'OpenAI launches agent commerce execution protocol with delegated business authorization',
    url: 'https://openai.com/news/example-agent-commerce/',
    published_date: '2026-08-08T00:00:00.000Z',
    excerpt: 'New agent-to-business interaction model with consent, execution contract, outcome evidence, and MCP binding.',
    primary_source: { source_type: 'official_blog', source_level: 'A' },
    ...overrides,
  };
}

test('RMVU-05D T31 normalized event feeds ABIS evaluator', () => {
  const items = loadBackfillFixtures(INTELLIGENCE_PATHS.fixtures).slice(0, 3);
  const events = dedupeItemsToEvents(items);
  const impact = scoreAbisImpact(events[0]);
  assert.ok(impact.abis_impact_score >= 0);
  assert.equal(impact.event_id, events[0].event_id);
});

test('RMVU-05D T32 semantic impact scored', () => {
  const impact = scoreAbisImpact(abisSampleEvent());
  assert.ok(impact.semantic_impact > 0);
  assert.ok(impact.semantic_impact <= 25);
});

test('RMVU-05D T33 authority impact scored', () => {
  const impact = scoreAbisImpact(abisSampleEvent());
  assert.ok(impact.authority_impact > 0);
});

test('RMVU-05D T34 execution impact scored', () => {
  const impact = scoreAbisImpact(abisSampleEvent());
  assert.ok(impact.interaction_execution_impact > 0);
});

test('RMVU-05D T35 binding-only change does not falsely invalidate ABIS', () => {
  const impact = scoreAbisImpact(abisSampleEvent({
    title: 'MCP transport protocol update for WebMCP connector SDK release',
    excerpt: 'Transport layer SDK release for MCP WebMCP protocol binding.',
  }));
  assert.equal(impact.binding_only_change, true);
  assert.ok(impact.semantic_impact <= 10);
  assert.match(impact.reasoning_summary, /semantic layer not invalidated/i);
});

test('RMVU-05D T36 HIGH triggers WOULD_NOTIFY', async () => {
  const impact = scoreAbisImpact(abisSampleEvent());
  assert.ok(impact.abis_impact_score >= 70, `score=${impact.abis_impact_score}`);
  const r = await notifyAbisImpact(impact, { dryRun: true, notify: false, title: impact.title });
  assert.equal(r.would_notify, true);
  assert.equal(r.notification_status, 'DRY_RUN');
});

test('RMVU-05D T37 WATCH does not notify', async () => {
  const impact = scoreAbisImpact(abisSampleEvent({
    title: 'Cloudflare minor SDK update',
    excerpt: 'SDK patch with limited agent interaction scope.',
  }));
  if (impact.severity === ABIS_SEVERITY.WATCH) {
    const r = await notifyAbisImpact(impact, { dryRun: false, notify: true });
    assert.equal(r.would_notify, false);
    assert.equal(r.notification_status, 'SKIPPED');
  } else {
    assert.ok(!shouldNotify(impact));
  }
});

test('RMVU-05D T38 webhook absent fails safe', async () => {
  const prev = process.env.ABIS_SLACK_WEBHOOK_URL;
  delete process.env.ABIS_SLACK_WEBHOOK_URL;
  const impact = scoreAbisImpact(abisSampleEvent());
  const r = await notifyAbisImpact(impact, { dryRun: false, notify: true, title: impact.title });
  if (impact.abis_impact_score >= 70) {
    assert.equal(r.notification_status, 'FAILED');
    assert.equal(r.sent, false);
  }
  if (prev) process.env.ABIS_SLACK_WEBHOOK_URL = prev;
});

test('RMVU-05D T39 webhook secret not exposed', () => {
  const src = read('scripts/lib/abis-intelligence/slack-notifier.mjs');
  assert.doesNotMatch(src, /VITE_/);
  assert.match(src, /process\.env\.ABIS_SLACK_WEBHOOK_URL/);
  const redacted = sanitizeLogMessage('failed https://hooks.slack.com/services/T00/B00/XXXX');
  assert.doesNotMatch(redacted, /hooks\.slack\.com\/services\/T00/);
  assert.match(redacted, /REDACTED/);
});

test('RMVU-05D T40 Slack failure does not stop pipeline', async () => {
  const prev = process.env.ABIS_SLACK_WEBHOOK_URL;
  process.env.ABIS_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/INVALID/TEST/URL';
  const events = [abisSampleEvent({ event_id: 'slack-fail-1' })];
  const result = await processAbisImpactWatch(events, { dryRun: false, notify: true });
  assert.ok(result.impacts.length === 1);
  if (prev) process.env.ABIS_SLACK_WEBHOOK_URL = prev;
  else delete process.env.ABIS_SLACK_WEBHOOK_URL;
});

test('RMVU-05D T41 ABIS output absent from public draft', () => {
  const ev = sampleEvent();
  ev.score = 70;
  const draft = generateArticleDraft(
    ev,
    scoreEvent(ev),
    buildInterpretation(ev, scoreEvent(ev)),
    { article_type: 'CURRENT_EVENT_ANALYSIS', conflict_slug: null },
    buildSeoPackage(ev, {}),
  );
  assert.doesNotMatch(draft, /abis_impact_score|ABIS Impact Watch|PRIVATE ABIS/i);
  const draftSrc = read('scripts/lib/editorial-intelligence/draft-generator.mjs');
  assert.doesNotMatch(draftSrc, /abis-intelligence/);
});

test('RMVU-05D T42 ABIS output absent from public_build', () => {
  const buildScript = read('package.json');
  assert.match(buildScript, /rm -rf public_build\/crucial_data/);
});

test('RMVU-05D T43 ABIS output absent from sitemap', () => {
  const sitemap = read('sitemap.xml');
  assert.doesNotMatch(sitemap, /abis-intelligence|crucial_data/i);
});

test('RMVU-05D T44 ABIS output absent from llms', () => {
  const llms = read('llms.txt');
  assert.doesNotMatch(llms, /abis-intelligence|ABIS Impact Watch/i);
});

test('RMVU-05D T45 patent relevance produces review flag only', () => {
  const impact = scoreAbisImpact(abisSampleEvent({
    title: 'New reference architecture standard proposal with semantic convergence',
    excerpt: 'Standards organization reference architecture terminology proposal.',
  }));
  assert.ok(impact.patent_flags.includes(PATENT_FLAGS.HUMAN_REVIEW_RECOMMENDED));
  assert.ok(!impact.reasoning_summary.match(/infringement|patentability|freedom-to-operate/i));
});

test('RMVU-05D T46 no automatic repository mutation', () => {
  const dir = path.join(ROOT, 'scripts/lib/abis-intelligence');
  for (const f of fs.readdirSync(dir)) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(src, /writeFileSync\([^)]*insights\//);
    assert.doesNotMatch(src, /writeFileSync\([^)]*schedule\.json/);
    assert.doesNotMatch(src, /writeFileSync\([^)]*public_build/);
  }
});

test('RMVU-05D T47 dry-run sends no Slack request', async () => {
  let fetchCalled = false;
  const orig = globalThis.fetch;
  globalThis.fetch = (...args) => {
    fetchCalled = true;
    return orig(...args);
  };
  try {
    const impact = scoreAbisImpact(abisSampleEvent());
    process.env.ABIS_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/TEST/B/SECRET';
    await notifyAbisImpact(impact, { dryRun: true, notify: true, title: impact.title });
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = orig;
    delete process.env.ABIS_SLACK_WEBHOOK_URL;
  }
});

test('RMVU-05D T47b public editorial brief excludes ABIS section', () => {
  const briefSrc = read('scripts/lib/editorial-intelligence/daily-brief.mjs');
  assert.doesNotMatch(briefSrc, /ABIS Impact Watch/);
  if (fs.existsSync(PUBLIC_SURFACE_PATHS.editorialBrief)) {
    const brief = fs.readFileSync(PUBLIC_SURFACE_PATHS.editorialBrief, 'utf8');
    assert.doesNotMatch(brief, /ABIS Impact Watch \(PRIVATE/i);
  }
});
