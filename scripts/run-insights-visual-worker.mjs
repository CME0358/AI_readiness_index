#!/usr/bin/env node
import path from 'node:path';
import { DEFAULT_ROOT, configFor, runWorker } from './lib/local-visual-worker.mjs';

const args = new Set(process.argv.slice(2));
const rootArg = process.argv.indexOf('--root');
const root = path.resolve(rootArg >= 0 ? process.argv[rootArg + 1] : DEFAULT_ROOT);
const mode = args.has('--dry-run') ? 'dry-run' : args.has('--simulate') ? 'simulate' : 'run';

if (rootArg >= 0 && !root) {
  console.error('Missing value for --root');
  process.exit(2);
}

const result = await runWorker({
  root,
  dryRun: mode === 'dry-run',
  simulate: mode === 'simulate',
  productionCheck: mode === 'simulate' ? async () => ({ ok: true, status: 200, simulated: true }) : undefined,
  configOverrides: configFor(root),
});

console.log(JSON.stringify({ mode, ...result }, null, 2));
process.exit(result.finalResult === 'VISUAL_WORKER_SKIPPED' || result.finalResult === 'VISUAL_WORKER_REMOTE_DIVERGED' ? 0 : 0);
