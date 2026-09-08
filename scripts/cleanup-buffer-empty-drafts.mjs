#!/usr/bin/env node
/**
 * Remove unauthorized empty Buffer drafts and draft ContentItems.
 *
 * Usage:
 *   node scripts/cleanup-buffer-empty-drafts.mjs --dry-run
 *   node scripts/cleanup-buffer-empty-drafts.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadCanonicalBufferEnv } from './lib/buffer-env.mjs';
import { cleanupBufferEmptyDrafts, findRemovableDrafts } from './lib/buffer-draft-cleanup.mjs';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  loadCanonicalBufferEnv();
  const preview = await findRemovableDrafts();
  if (preview.removable.length === 0) {
    console.log('BUFFER_DRAFT_CLEANUP: no removable drafts detected');
  } else {
    console.log('BUFFER_DRAFT_CLEANUP_PREVIEW:', JSON.stringify(preview.removable, null, 2));
  }

  const result = await cleanupBufferEmptyDrafts({ dryRun });
  const outDir = path.join(process.cwd(), 'artifacts');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'buffer-draft-cleanup.json');
  fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    dryRun: result.dryRun,
    deletedPosts: result.deletedPosts.length,
    deletedContentItems: result.deletedContentItems.length,
    keptFuturePosts: result.keptFuturePosts,
    report: outFile,
  }, null, 2));
}

main().catch((error) => {
  console.error('BUFFER_DRAFT_CLEANUP_FAILED');
  console.error(error.message);
  process.exit(1);
});
