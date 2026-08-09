#!/usr/bin/env node
/**
 * RMVU-05D — Editorial Intelligence pipeline CLI.
 * Default: --dry-run (no schedule mutation, no publish, no IndexNow).
 */
import { runIntelligencePipeline } from './lib/editorial-intelligence/pipeline.mjs';
import { loadSourcesRegistry } from './lib/editorial-intelligence/sources.mjs';
import { loadQueue, loadEvents } from './lib/editorial-intelligence/storage.mjs';
import { INTELLIGENCE_PATHS } from './lib/editorial-intelligence/paths.mjs';

const args = process.argv.slice(2);
const dryRun = !args.includes('--live');
const backfill = args.includes('--backfill');
const fetchOnly = args.includes('--fetch');
const scoreOnly = args.includes('--score');
const queueOnly = args.includes('--queue');

async function main() {
  if (args.includes('--help')) {
    console.log(`Usage: node scripts/intelligence-run.mjs [options]

Options:
  --dry-run       Default. No schedule mutation / publish / IndexNow / Slack
  --live          Persist registry health updates (still no auto-publish)
  --backfill      Use fixture items (max 5 test events)
  --abis-notify   Enable Slack send (requires ABIS_SLACK_WEBHOOK_URL; still respects --dry-run)
  --fetch         Fetch sources only
  --score         Show last scored events
  --queue         Show priority queue
`);
    process.exit(0);
  }

  if (queueOnly) {
    const q = loadQueue();
    console.log(JSON.stringify(q, null, 2));
    return;
  }

  if (scoreOnly) {
    const ev = loadEvents();
    console.log(JSON.stringify(ev.events?.slice(0, 10) || [], null, 2));
    return;
  }

  if (fetchOnly) {
    const { fetchAllSources } = await import('./lib/editorial-intelligence/pipeline.mjs');
    const r = await fetchAllSources({ useBackfill: backfill, dryRun });
    console.log(`Fetched ${r.items.length} items, errors: ${r.errors.length}`);
    return;
  }

  const result = await runIntelligencePipeline({ dryRun, backfill, abisNotify: args.includes('--abis-notify') });
  console.log('RMVU-05D Editorial Intelligence — run complete');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE (no auto-publish)'}`);
  console.log(`Items: ${result.rawCount} · Events: ${result.eventCount} · Duplicates merged: ${result.duplicates}`);
  console.log(`Processed: ${result.processed.length} · Ignored: ${result.ignored.length} · Blocked: ${result.blocked.length}`);
  console.log(`P0: ${result.p0.length} · P1: ${result.p1.length} · P2: ${result.p2.length}`);
  if (result.liveP1) {
    console.log(`Live active P1: ${result.liveP1.length} · Queue pruned: ${result.queueReconciled ?? 0}`);
  }
  console.log(`Daily brief: ${INTELLIGENCE_PATHS.dailyBrief}`);
  console.log(`Schedule mutation: ${result.scheduleMutation ? 'YES' : 'NO'}`);
  if (result.abisWatch) {
    const aw = result.abisWatch;
    console.log(`ABIS Impact Watch: CRITICAL ${aw.critical.length} · HIGH ${aw.high.length} · WATCH ${aw.watch.length} · LOG ${aw.logOnly.length}`);
    console.log(`Private brief: crucial_data/abis-intelligence/internal-daily-brief.md`);
  }
  if (result.fetchErrors?.length) {
    console.log('Fetch errors:', result.fetchErrors.map((e) => `${e.source_id}:${e.error}`).join(', '));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
