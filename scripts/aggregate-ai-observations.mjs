#!/usr/bin/env node
/**
 * Aggregate manual AI observation CSV for a wave.
 * Usage: node scripts/aggregate-ai-observations.mjs --wave 2026-W36 --input observation/weekly/2026-W36/ai-responses.csv
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseCsv } from './lib/observation/channel-import.mjs';
import { normalizeRecord, csvHeaderLine } from './lib/observation/ai-response-schema.mjs';
import { aggregateAiResponses } from './lib/observation/ai-response-aggregator.mjs';

function parseArgs(argv) {
  const args = { wave: '', input: '', output: '' };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--wave') args.wave = argv[++i];
    else if (argv[i] === '--input') args.input = argv[++i];
    else if (argv[i] === '--output') args.output = argv[++i];
    else if (argv[i] === '--help') args.help = true;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    console.log(`Usage: node scripts/aggregate-ai-observations.mjs --wave <id> --input <csv> [--output json]`);
    process.exit(args.help ? 0 : 1);
  }

  const inputPath = resolve(args.input);
  if (!existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`);
    process.exit(1);
  }

  const text = readFileSync(inputPath, 'utf8');
  const { rows } = parseCsv(text);
  const normalized = rows.map((row, idx) => normalizeRecord(row, idx + 2));
  const aggregate = aggregateAiResponses(normalized);

  const payload = {
    wave_id: args.wave || 'unspecified',
    generated_at: new Date().toISOString(),
    input_file: inputPath,
    expected_header: csvHeaderLine(),
    parse_error_count: normalized.filter((n) => n.errors.length).length,
    aggregate,
  };

  const out = args.output
    ? resolve(args.output)
    : join(dirname(inputPath), 'ai-aggregate.json');

  writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ ok: true, output: out, denominator: aggregate.counts.valid_denominator }, null, 2));
}

main();
