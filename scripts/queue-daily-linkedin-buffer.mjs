#!/usr/bin/env node
/**
 * Daily LinkedIn → Buffer transfer (1 post per business day).
 * Usage:
 *   node scripts/queue-daily-linkedin-buffer.mjs
 *   node scripts/queue-daily-linkedin-buffer.mjs --dry-run
 *   node scripts/queue-daily-linkedin-buffer.mjs --now 2026-08-05T10:15:00+09:00
 *   node scripts/queue-daily-linkedin-buffer.mjs --force-slug ai-search-shift
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, ROOT, articleUrl } from './lib/insights-v2-paths.mjs';
import { toJstDateString, isWeekday } from './lib/business-days.mjs';
import {
  createBufferPost,
  getBufferConfig,
  isBufferConfigured,
  isRateLimitError,
} from './lib/buffer-client.mjs';
import { verifyArticleUrl } from './lib/url-verify.mjs';
import { verifyProductionSocialAssets } from './lib/insights-social-media.mjs';
import { EDITORIAL_STATUSES, isBufferEligible } from './lib/editorial-status.mjs';
import { isProductionVerified } from './lib/publishing-state-machine.mjs';

const dryRun = process.argv.includes('--dry-run');
const forceSlug = (() => {
  const i = process.argv.indexOf('--force-slug');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const nowArg = (() => {
  const i = process.argv.indexOf('--now');
  return i >= 0 ? process.argv[i + 1] : null;
})();

const now = nowArg ? new Date(nowArg) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error('Invalid --now');
  process.exit(1);
}

function readJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  if (dryRun) return;
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function appendLog(p, entry) {
  const log = readJson(p, { entries: [], updatedAt: null });
  log.entries.push(entry);
  log.updatedAt = new Date().toISOString();
  writeJson(p, log);
}

function loadLinkedInText(contentFile) {
  const abs = path.isAbsolute(contentFile) ? contentFile : path.join(ROOT, contentFile);
  if (!fs.existsSync(abs)) throw new Error(`Missing LinkedIn content: ${abs}`);
  return fs.readFileSync(abs, 'utf8').trim();
}

function pickTodayPost(queue, todayYmd) {
  if (forceSlug) {
    const forced = queue.posts.find((p) => p.slug === forceSlug);
    if (forced?.status === EDITORIAL_STATUSES.HOLD) {
      console.error(`editorial_hold cannot be transferred (even with --force-slug): ${forceSlug}`);
      process.exit(1);
    }
  }

  const candidates = queue.posts.filter((p) => {
    if (forceSlug) return p.slug === forceSlug;
    if (p.status === EDITORIAL_STATUSES.HOLD) return false;
    if (!p.bufferTransferAt) return false;
    const transferYmd = toJstDateString(new Date(p.bufferTransferAt));
    return transferYmd === todayYmd;
  });

  if (!candidates.length) return null;

  const eligible = candidates.filter(
    (p) =>
      isBufferEligible(p, { forceSlug }) &&
      !p.bufferUpdateId &&
      p.status !== 'buffer_queued' &&
      p.status !== 'published'
  );

  return eligible[0] || null;
}

async function main() {
  if (!isWeekday(now) && !forceSlug) {
    console.log('Weekend — no transfer.', { now: now.toISOString() });
    process.exit(0);
  }

  const todayYmd = toJstDateString(now);
  const queue = readJson(PATHS.linkedinQueue, null);
  if (!queue?.posts?.length) {
    console.log('Empty LinkedIn queue.');
    process.exit(0);
  }

  if (queue.policy?.postsPerTransfer !== 1) {
    console.error('postsPerTransfer must be 1');
    process.exit(1);
  }

  const post = pickTodayPost(queue, todayYmd);
  if (!post) {
    console.log('No post due for transfer.', { todayYmd });
    process.exit(0);
  }

  // Duplicate slug/url guard across queue
  const dupBuffer = queue.posts.filter((p) => p.bufferUpdateId && p.slug === post.slug);
  if (dupBuffer.length && post.bufferUpdateId) {
    console.log('Already has bufferUpdateId — skip.', post.slug);
    process.exit(0);
  }

  console.log(`${dryRun ? '[dry-run] ' : ''}Processing ${post.id} (${post.slug})`);

  const schedule = readJson(PATHS.schedule, { articles: [] });
  const scheduleEntry = schedule.articles.find((article) => article.slug === post.slug);
  if (!isProductionVerified(scheduleEntry)) {
    console.warn('Production verification gate is not satisfied — Buffer handoff blocked.');
    console.log('SOCIAL_MEDIA_BLOCKED_PRODUCTION_NOT_VERIFIED');
    process.exit(dryRun ? 0 : 1);
  }

  // Verify article URL
  const verify = await verifyProductionSocialAssets(post.slug, { verifyArticle: verifyArticleUrl });
  if (!verify.ok) {
    console.warn('URL verify failed:', verify.reason);
    if (!dryRun) {
      post.status = 'article_url_unavailable';
      post.lastError = verify.reason;
      post.attempts = (post.attempts || 0) + 1;
      post.lastAttemptAt = now.toISOString();
      post.updatedAt = now.toISOString();
      appendLog(PATHS.linkedinFailedLog, {
        at: now.toISOString(),
        id: post.id,
        slug: post.slug,
        status: post.status,
        error: verify.reason,
        dryRun,
      });
      writeJson(PATHS.linkedinQueue, queue);
    }
    console.log('[dry-run] Would set article_url_unavailable — no queue write');
    process.exit(dryRun ? 0 : 1);
  }

  post.status = post.status === 'scheduled' ? 'article_published' : post.status;
  post.status = 'ready_for_buffer';

  const cfg = getBufferConfig();
  if (!dryRun && !isBufferConfigured(cfg)) {
    console.error('BUFFER_ACCESS_TOKEN and BUFFER_CHANNEL_ID required for live transfer.');
    post.status = 'manual_review';
    post.lastError = 'Buffer credentials not configured';
    post.updatedAt = now.toISOString();
    writeJson(PATHS.linkedinQueue, queue);
    process.exit(1);
  }

  let text;
  try {
    text = loadLinkedInText(post.contentFile);
  } catch (err) {
    post.status = 'buffer_transfer_failed';
    post.lastError = String(err.message);
    post.attempts = (post.attempts || 0) + 1;
    post.lastAttemptAt = now.toISOString();
    post.updatedAt = now.toISOString();
    appendLog(PATHS.linkedinFailedLog, { at: now.toISOString(), id: post.id, slug: post.slug, error: post.lastError, dryRun });
    writeJson(PATHS.linkedinQueue, queue);
    process.exit(1);
  }

  const { postId, error, rejected } = await createBufferPost({
    channelKey: 'linkedin',
    channelId: cfg.channelId,
    accessToken: cfg.accessToken,
    text,
    mediaUrl: verify.mediaUrl || null,
    dueAt: post.linkedinPublishAt,
    dryRun,
  });

  post.lastAttemptAt = now.toISOString();
  post.attempts = (post.attempts || 0) + 1;

  if (error) {
    post.lastError = error;
    if (rejected) {
      post.status = 'buffer_rejected';
    } else if (isRateLimitError(error)) {
      post.status = 'buffer_transfer_failed';
    } else {
      post.status = 'buffer_transfer_failed';
    }
    appendLog(PATHS.linkedinFailedLog, {
      at: now.toISOString(),
      id: post.id,
      slug: post.slug,
      status: post.status,
      error,
      dryRun,
    });
    writeJson(PATHS.linkedinQueue, queue);
    console.error('Buffer transfer failed:', error);
    process.exit(dryRun ? 0 : 1);
  }

  post.bufferUpdateId = postId;
  post.status = 'buffer_queued';
  post.lastError = null;
  post.updatedAt = now.toISOString();

  appendLog(PATHS.linkedinPublishedLog, {
    at: now.toISOString(),
    id: post.id,
    slug: post.slug,
    bufferUpdateId: postId,
    linkedinPublishAt: post.linkedinPublishAt,
    dryRun,
  });

  writeJson(PATHS.linkedinQueue, queue);
  console.log('Buffer queued:', post.slug, postId);
  console.log('UPDATED=1');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
