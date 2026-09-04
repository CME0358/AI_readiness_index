#!/usr/bin/env node
import { DEFAULT_ROOT, VISUAL_MODES, runWorker } from './lib/local-visual-worker.mjs';

const args = process.argv.slice(2);
const rootArg = args.indexOf('--root');
const root = rootArg >= 0 ? args[rootArg + 1] : DEFAULT_ROOT;
const modeArg = args.indexOf('--mode');
const modeToken = modeArg >= 0 ? args[modeArg + 1] : 'prepublish';
const visualMode = modeToken === 'recovery'
  ? VISUAL_MODES.RECOVERY_POSTPUBLISH
  : VISUAL_MODES.PRIMARY_PREPUBLISH;
const dryRun = args.includes('--dry-run');
const simulate = args.includes('--simulate');

if (rootArg >= 0 && !root) {
  console.error('Missing value for --root');
  process.exit(2);
}

const result = await runWorker({
  root,
  dryRun,
  simulate,
  visualMode,
  productionCheck: simulate ? async () => ({ ok: true, status: 200, simulated: true }) : undefined,
});

console.log(JSON.stringify({ visualMode, ...result }, null, 2));
process.exit(0);
