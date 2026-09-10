#!/usr/bin/env node
/**
 * Phase 3 stock build CLI.
 * Usage: node scripts/phase3-stock-build.mjs [--skip-hero] [--slug name] [--json]
 */
import { runPhase3StockBuild } from './lib/phase3-stock-build.mjs';

const args = process.argv.slice(2);
const skipHero = args.includes('--skip-hero');
const jsonOut = args.includes('--json');
const slugArg = args.indexOf('--slug');
const slugs = slugArg >= 0 ? [args[slugArg + 1]] : null;

if (slugArg >= 0 && !slugs[0]) {
  console.error('Missing value for --slug');
  process.exit(2);
}

const report = await runPhase3StockBuild({ skipHero, slugs });

if (jsonOut) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('=== ARI PHASE 3 ARTICLE STOCK BUILD REPORT ===');
  console.log(`INPUT: ${report.input}`);
  console.log(`PACKAGE_READY: ${report.packageReady}`);
  console.log(`HOLD_READY: ${report.holdReady}`);
  console.log(`BLOCKED: ${report.blocked}`);
  console.log(`FAILED: ${report.failed}`);
  for (const r of report.results) {
    console.log(`\n--- ${r.rank}. ${r.slug} ---`);
    console.log(`TITLE: ${r.title}`);
    console.log(`SOURCE: ${r.sourceVerification?.status || 'N/A'}`);
    console.log(`ARTICLE: ${r.articleStatus}`);
    console.log(`LI/FB/X: ${r.linkedinValidation}/${r.facebookValidation}/${r.xValidation}`);
    console.log(`HERO: ${r.heroStatus} (${r.heroAttempts} attempts)`);
    console.log(`PACKAGE: ${r.packageReady ? 'PACKAGE_READY' : 'NOT_READY'}`);
    console.log(`STOCK: ${r.holdReady ? 'HOLD_READY' : 'NOT_READY'}`);
    if (r.errors?.length) console.log(`ERRORS: ${r.errors.join('; ')}`);
  }
  console.log('\n=== INVENTORY ===');
  console.log(JSON.stringify(report.inventory, null, 2));
  console.log(`BUFFER_MUTATED: ${report.bufferMutated}`);
}

process.exit(report.failed > 0 && report.holdReady === 0 ? 1 : 0);
