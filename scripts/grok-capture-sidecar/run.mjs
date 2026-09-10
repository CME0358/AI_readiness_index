#!/usr/bin/env node
/**
 * Grok OISUMMIT Capture sidecar CLI — parse preview or submit via existing API.
 * Usage:
 *   node scripts/grok-capture-sidecar/run.mjs parse --message "OISUMMIT記録 ..."
 *   node scripts/grok-capture-sidecar/run.mjs submit --message "..." --confirm
 *
 * Env:
 *   OISUMMIT_CAPTURE_API_URL (default https://readiness.coaretail.com/api/oisummit-capture-grok)
 *   OISUMMIT_GROK_CAPTURE_BOT_TOKEN or OISUMMIT_CAPTURE_ACCESS_TOKEN
 */
import { parseCaptureMessage } from '../lib/oisummit/grok-parser.mjs';

const DEFAULT_URL = 'https://readiness.coaretail.com/api/oisummit-capture-grok';

function parseArgs(argv) {
  const out = { command: argv[2] || 'parse', message: '', confirm: false };
  for (let i = 3; i < argv.length; i += 1) {
    if (argv[i] === '--message') out.message = argv[++i] || '';
    if (argv[i] === '--confirm') out.confirm = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.message) {
    console.error('message required');
    process.exit(1);
  }

  if (args.command === 'parse') {
    const parsed = parseCaptureMessage(args.message);
    console.log(JSON.stringify(parsed, null, 2));
    return;
  }

  if (args.command === 'submit') {
    const token = process.env.OISUMMIT_GROK_CAPTURE_BOT_TOKEN || process.env.OISUMMIT_CAPTURE_ACCESS_TOKEN;
    if (!token) {
      console.error('token required in env');
      process.exit(1);
    }
    const url = process.env.OISUMMIT_CAPTURE_API_URL || DEFAULT_URL;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: args.message, confirm: args.confirm }),
    });
    const body = await res.json().catch(() => ({}));
    console.log(JSON.stringify({ status: res.status, body }, null, 2));
    if (!res.ok || body.status === 'failed') process.exit(1);
    return;
  }

  console.error('unknown command');
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
