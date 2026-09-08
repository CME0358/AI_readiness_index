#!/usr/bin/env node
/**
 * Import official exports (GSC/GA4/Bing/CRM) and build weekly comparison JSON.
 * Usage: node scripts/import-observation-week.mjs --wave 2026-W36 --dir observation/weekly/2026-W36
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  importGscQueries,
  importGa4Export,
  importBingQueries,
  importCrmExport,
  parseCsv,
} from './lib/observation/channel-import.mjs';
import { buildWeeklyComparison } from './lib/observation/weekly-baseline.mjs';
import { normalizeRecord } from './lib/observation/ai-response-schema.mjs';
import { BRAND_MATCH_TERMS } from './lib/observation/constants.mjs';

function parseArgs(argv) {
  const args = { wave: '', dir: '', weekStart: '', weekEnd: '' };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--wave') args.wave = argv[++i];
    else if (argv[i] === '--dir') args.dir = argv[++i];
    else if (argv[i] === '--week-start') args.weekStart = argv[++i];
    else if (argv[i] === '--week-end') args.weekEnd = argv[++i];
    else if (argv[i] === '--help') args.help = true;
  }
  return args;
}

function readOptional(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.dir) {
    console.log('Usage: node scripts/import-observation-week.mjs --wave <id> --dir <folder> [--week-start YYYY-MM-DD] [--week-end YYYY-MM-DD]');
    process.exit(args.help ? 0 : 1);
  }

  const dir = resolve(args.dir);
  const imports = [];

  const gsc = readOptional(join(dir, 'gsc-queries.csv'));
  if (gsc) imports.push(importGscQueries(gsc, { brandTerms: BRAND_MATCH_TERMS }));

  const ga4 = readOptional(join(dir, 'ga4-export.csv'));
  if (ga4) imports.push(importGa4Export(ga4));

  const bing = readOptional(join(dir, 'bing-queries.csv'));
  if (bing) imports.push(importBingQueries(bing, { brandTerms: BRAND_MATCH_TERMS }));

  const crm = readOptional(join(dir, 'crm-export.csv'));
  let crmRows = [];
  if (crm) {
    imports.push(importCrmExport(crm));
    crmRows = parseCsv(crm).rows;
  }

  let aiRecords = [];
  const aiCsv = readOptional(join(dir, 'ai-responses.csv'));
  if (aiCsv) {
    aiRecords = parseCsv(aiCsv).rows.map((row, idx) => normalizeRecord(row, idx + 2));
  }

  const report = buildWeeklyComparison({
    waveId: args.wave || 'unspecified',
    weekStart: args.weekStart || '',
    weekEnd: args.weekEnd || '',
    aiRecords,
    channelImports: imports,
    crmRows,
  });

  const out = join(dir, 'weekly-report.json');
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, output: out, baseline_status: report.baseline_status }, null, 2));
}

main();
