/**
 * Keep legacy linkedin/queue.json in sync with multi-channel buffer queue status.
 */
import fs from 'node:fs';
import { PATHS } from './insights-v2-paths.mjs';
import { normalizePublicationDate, isSameBufferLedgerEntry } from './buffer-ledger.mjs';

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** @param {string} slug */
export function syncLinkedInQueueFromBuffer(slug, publicationDate = null) {
  if (!fs.existsSync(PATHS.linkedinQueue) || !fs.existsSync(PATHS.bufferQueue)) {
    return { updated: false, slug, reason: 'missing_queue_file' };
  }

  const bufferQueue = readJson(PATHS.bufferQueue);
  const linkedinQueue = readJson(PATHS.linkedinQueue);
  const bufPost = bufferQueue.posts.find((p) => isSameBufferLedgerEntry(p, slug, publicationDate));
  const liPost = linkedinQueue.posts.find((p) => p.slug === slug && (!publicationDate || normalizePublicationDate(p) === publicationDate));
  if (!bufPost || !liPost) {
    return { updated: false, slug, reason: 'missing_post' };
  }

  const linkedinChannel = bufPost.channels?.linkedin;
  const shouldSync =
    bufPost.status === 'buffer_queued' &&
    liPost.status === 'scheduled' &&
    linkedinChannel?.status === 'buffer_queued';

  if (!shouldSync) {
    return { updated: false, slug, reason: 'no_sync_needed' };
  }

  liPost.status = 'buffer_queued';
  liPost.bufferUpdateId = linkedinChannel.bufferUpdateId || liPost.bufferUpdateId;
  liPost.updatedAt = new Date().toISOString();
  writeJson(PATHS.linkedinQueue, linkedinQueue);
  return { updated: true, slug, bufferUpdateId: liPost.bufferUpdateId };
}

/** One-shot repair for all buffer_queued entries. */
export function syncAllLinkedInFromBuffer() {
  if (!fs.existsSync(PATHS.bufferQueue)) return [];
  const bufferQueue = readJson(PATHS.bufferQueue);
  return bufferQueue.posts
    .filter((p) => p.status === 'buffer_queued')
    .map((p) => syncLinkedInQueueFromBuffer(p.slug, normalizePublicationDate(p)));
}
