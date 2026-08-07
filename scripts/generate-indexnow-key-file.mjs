#!/usr/bin/env node
/**
 * Generate IndexNow verification file in public_build/ (never in repo root).
 *
 * Usage:
 *   node scripts/generate-indexnow-key-file.mjs [--out public_build]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateIndexNowKey, maskIndexNowKey } from './lib/indexnow-client.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const outArgIdx = process.argv.indexOf('--out');
const outDir = outArgIdx >= 0 ? path.resolve(process.argv[outArgIdx + 1]) : path.join(ROOT, 'public_build');

const key = process.env.INDEXNOW_KEY;

if (!key) {
  console.warn('IndexNow key file: SKIPPED — INDEXNOW_KEY not configured');
  process.exit(0);
}

const keyCheck = validateIndexNowKey(key);
if (!keyCheck.ok) {
  console.warn(`IndexNow key file: SKIPPED — ${keyCheck.error}`);
  process.exit(0);
}

fs.mkdirSync(outDir, { recursive: true });
const filePath = path.join(outDir, `${key}.txt`);
fs.writeFileSync(filePath, `${key}\n`, 'utf8');
console.log(`IndexNow key file: wrote ${filePath} (key ${maskIndexNowKey(key)})`);
