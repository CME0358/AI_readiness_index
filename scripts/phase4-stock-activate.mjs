#!/usr/bin/env node
/**
 * Phase 4 — Controlled HOLD_READY → SCHEDULED activation.
 * Usage: node scripts/phase4-stock-activate.mjs [--dry-run] [--json]
 */
import { activateHoldStock, validateActivationPlan } from './lib/phase4-stock-activate.mjs';
import { loadSchedule } from './lib/insights-package-readiness.mjs';

const dryRun = process.argv.includes('--dry-run');
const jsonOut = process.argv.includes('--json');

const plan = validateActivationPlan(loadSchedule());
if (!plan.ok) {
  console.error(JSON.stringify({ ok: false, phase: 'pre-flight', errors: plan.errors }, null, 2));
  process.exit(1);
}

const result = activateHoldStock({ dryRun });
if (jsonOut) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('=== ARI PHASE 4 CONTROLLED STOCK ACTIVATION ===');
  console.log(`OK: ${result.ok}`);
  if (result.results) {
    for (const r of result.results) {
      console.log(`${r.slotDate} ${r.slug} → SCHEDULED ${r.publishAt}`);
      console.log(`  publicationId: ${r.publicationId}`);
      console.log(`  HERO_REUSED: ${r.heroReused}`);
      console.log(`  LIVE: ${r.liveExists ? 'YES (BLOCKED)' : 'NO'}`);
    }
  }
  if (result.report?.inventory) {
    console.log('INVENTORY:', JSON.stringify(result.report.inventory));
  }
  console.log(`BUFFER_MUTATED: ${result.bufferMutated ?? false}`);
}

process.exit(result.ok ? 0 : 1);
