#!/usr/bin/env node
import { DEFAULT_ROOT, VISUAL_MODES, runWorker } from './lib/local-visual-worker.mjs';
import {
  PREPUBLISH_ROLES,
  resolvePrepublishRole,
} from './lib/trigger-immediate-prepublish-hero.mjs';
import { evaluateMorningPreflight } from './lib/insights-package-readiness.mjs';

const args = process.argv.slice(2);
const rootArg = args.indexOf('--root');
const root = rootArg >= 0 ? args[rootArg + 1] : DEFAULT_ROOT;
const modeArg = args.indexOf('--mode');
const modeToken = modeArg >= 0 ? args[modeArg + 1] : null;
const dryRun = args.includes('--dry-run');
const simulate = args.includes('--simulate');
const role = resolvePrepublishRole();

if (rootArg >= 0 && !root) {
  console.error('Missing value for --root');
  process.exit(2);
}

if (role === PREPUBLISH_ROLES.MORNING_PREFLIGHT) {
  const report = evaluateMorningPreflight({ root });
  console.log(JSON.stringify({ role, report }, null, 2));
  if (report.ok) process.exit(0);
  if (dryRun || simulate) process.exit(0);
  const result = await runWorker({
    root,
    dryRun,
    simulate,
    visualMode: VISUAL_MODES.PRIMARY_PREPUBLISH,
    productionCheck: simulate ? async () => ({ ok: true, status: 200, simulated: true }) : undefined,
  });
  console.log(JSON.stringify({ role, action: 'MORNING_PREFLIGHT_RECOVERY', result }, null, 2));
  process.exit(result.finalResult === 'SUCCESS' ? 0 : 1);
}

const visualMode = modeToken === 'recovery'
  ? VISUAL_MODES.RECOVERY_POSTPUBLISH
  : VISUAL_MODES.PRIMARY_PREPUBLISH;

const result = await runWorker({
  root,
  dryRun,
  simulate,
  visualMode,
  productionCheck: simulate ? async () => ({ ok: true, status: 200, simulated: true }) : undefined,
});

console.log(JSON.stringify({ role, visualMode, ...result }, null, 2));
process.exit(
  result.finalResult === 'SUCCESS' || result.finalResult === 'NO_PREPUBLISH_CANDIDATE' || result.finalResult === 'DRY_RUN_CANDIDATE'
    ? 0
    : 1,
);
