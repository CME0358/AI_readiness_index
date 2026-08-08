#!/usr/bin/env node
/**
 * TMVU-05 — Pre-publish Editorial & Search Intent Gate validator.
 *
 * Usage:
 *   npm run validate:insights:prepublish
 *   node scripts/tmvu-05-validate.mjs --slug ari-vs-geo-seo
 *   node scripts/tmvu-05-validate.mjs --json
 */
import {
  runGateOnAllScheduled,
  runPrepublishEditorialGate,
  buildCannibalizationReport,
  PROTECTED_ABIS_SLUGS,
  simulatePublishGate,
} from './lib/prepublish-editorial-gate.mjs';
import { loadSchedule } from './lib/insights-related-links.mjs';

const slugArg = (() => {
  const i = process.argv.indexOf('--slug');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const jsonOut = process.argv.includes('--json');
const simulate = process.argv.includes('--simulate');

let results;
if (simulate && slugArg) {
  results = [simulatePublishGate(slugArg)];
} else if (slugArg) {
  results = [runPrepublishEditorialGate(slugArg)];
} else {
  results = runGateOnAllScheduled();
}

const schedule = loadSchedule();
const cannibalization = buildCannibalizationReport(schedule.articles);

let exitCode = 0;
const blocked = results.filter((r) => r.status === 'BLOCKED');
const observations = results.filter((r) => r.status === 'PASS_WITH_OBSERVATIONS');
const passed = results.filter((r) => r.status === 'PASS');

if (blocked.some((r) => !PROTECTED_ABIS_SLUGS.has(r.slug))) {
  exitCode = 1;
}

if (jsonOut) {
  console.log(JSON.stringify({ results, cannibalization }, null, 2));
  process.exit(exitCode);
}

console.log(`TMVU-05 validation: ${exitCode ? 'FAIL' : 'PASS'}`);
console.log(`Scheduled articles: ${results.length}`);
console.log(`PASS: ${passed.length}, PASS_WITH_OBSERVATIONS: ${observations.length}, BLOCKED: ${blocked.length}`);
console.log(`Protected ABIS: ${PROTECTED_ABIS_SLUGS.size}`);

if (blocked.length) {
  console.error('\nBlocked:');
  for (const r of blocked) {
    const codes = r.blockers.map((b) => b.code).join(', ');
    console.error(` - ${r.slug}: ${codes}`);
  }
}

if (observations.length && !slugArg) {
  console.log('\nObservations (non-blocking):');
  for (const r of observations.slice(0, 10)) {
    console.log(` - ${r.slug}: ${r.observations.map((o) => o.code).join(', ')}`);
  }
  if (observations.length > 10) console.log(` ... and ${observations.length - 10} more`);
}

if (simulate) {
  console.log(`\nPublish simulation (${slugArg}): ${results[0].status}`);
}

process.exit(exitCode);
