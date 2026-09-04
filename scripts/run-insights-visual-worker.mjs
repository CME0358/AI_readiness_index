#!/usr/bin/env node
import path from 'node:path';
import { DEFAULT_ROOT, VISUAL_MODES, configFor, runWorker } from './lib/local-visual-worker.mjs';

const args = process.argv.slice(2);
const argSet = new Set(args);
const rootArg = args.indexOf('--root');
const root = path.resolve(rootArg >= 0 ? args[rootArg + 1] : DEFAULT_ROOT);
const modeArg = args.indexOf('--mode');
const modeToken = modeArg >= 0 ? args[modeArg + 1] : 'recovery';
const visualMode = modeToken === 'prepublish'
  ? VISUAL_MODES.PRIMARY_PREPUBLISH
  : VISUAL_MODES.RECOVERY_POSTPUBLISH;
const mode = argSet.has('--dry-run') ? 'dry-run' : argSet.has('--simulate') ? 'simulate' : 'run';

if (rootArg >= 0 && !root) {
  console.error('Missing value for --root');
  process.exit(2);
}

const result = await runWorker({
  root,
  dryRun: mode === 'dry-run',
  simulate: mode === 'simulate',
  visualMode,
  productionCheck: mode === 'simulate' ? async () => ({ ok: true, status: 200, simulated: true }) : undefined,
  configOverrides: configFor(root),
});

console.log(JSON.stringify({ mode, visualMode, ...result }, null, 2));
process.exit(0);
