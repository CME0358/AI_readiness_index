#!/usr/bin/env node
import { evaluateMorningPreflight } from './lib/insights-package-readiness.mjs';
import { VISUAL_MODES, runWorker } from './lib/local-visual-worker.mjs';

const args = new Set(process.argv.slice(2));
const recover = args.has('--recover');
const report = evaluateMorningPreflight();
console.log(JSON.stringify(report, null, 2));

if (!recover) {
  process.exit(report.ok ? 0 : 1);
}

if (report.ok) {
  console.log(JSON.stringify({ action: 'NO_RECOVERY_REQUIRED' }, null, 2));
  process.exit(0);
}

const result = await runWorker({ visualMode: VISUAL_MODES.PRIMARY_PREPUBLISH });
console.log(JSON.stringify({ action: 'PREPUBLISH_RECOVERY', result }, null, 2));
process.exit(result.finalResult === 'SUCCESS' ? 0 : 1);
