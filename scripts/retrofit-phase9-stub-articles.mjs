#!/usr/bin/env node
import { retrofitPhase9StubArticles } from './lib/retrofit-phase9-stub-html.mjs';

const dryRun = process.argv.includes('--dry-run');
const results = retrofitPhase9StubArticles({ dryRun });
console.log(JSON.stringify(results.map((result) => ({
  slug: result.slug,
  ok: result.prepared.ok,
  error: result.prepared.error || result.prepared.message || null,
})), null, 2));
process.exit(results.some((result) => !result.prepared.ok) ? 1 : 0);
