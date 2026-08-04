#!/usr/bin/env node
/**
 * Daily multi-channel Buffer transfer (LinkedIn + Facebook + X).
 * One article per business day; per-channel idempotency via bufferUpdateId.
 *
 * Usage:
 *   node scripts/queue-daily-buffer-posts.mjs
 *   node scripts/queue-daily-buffer-posts.mjs --dry-run
 *   node scripts/queue-daily-buffer-posts.mjs --channels facebook,x
 *   node scripts/queue-daily-buffer-posts.mjs --force-slug ai-search-shift --channels facebook,x
 *   node scripts/queue-daily-buffer-posts.mjs --now 2026-08-04T12:00:00+09:00
 */
import { PATHS } from './lib/insights-v2-paths.mjs';
import { toJstDateString, isWeekday } from './lib/business-days.mjs';
import {
  createBufferPost,
  getBufferConfig,
} from './lib/buffer-client.mjs';
import { verifyArticleUrl } from './lib/url-verify.mjs';
import { CHANNEL_KEYS } from './lib/social-channels.mjs';
import {
  readJsonFile,
  pickTodayArticle,
  processArticleChannels,
  parseChannelsArg,
} from './lib/buffer-dispatcher.mjs';

const dryRun = process.argv.includes('--dry-run');
const forceSlug = (() => {
  const i = process.argv.indexOf('--force-slug');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const nowArg = (() => {
  const i = process.argv.indexOf('--now');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const channelsArg = (() => {
  const i = process.argv.indexOf('--channels');
  return i >= 0 ? process.argv[i + 1] : 'linkedin,facebook,x';
})();

const now = nowArg ? new Date(nowArg) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error('Invalid --now');
  process.exit(1);
}

const requestedChannels = parseChannelsArg(channelsArg);

async function main() {
  if (!isWeekday(now) && !forceSlug) {
    console.log('Weekend — no transfer.', { now: now.toISOString() });
    process.exit(0);
  }

  const todayYmd = toJstDateString(now);
  const queue = readJsonFile(PATHS.bufferQueue, null);
  if (!queue?.posts?.length) {
    console.error('Empty buffer queue. Run: node scripts/init-buffer-queue.mjs');
    process.exit(1);
  }

  if (queue.policy?.postsPerTransfer !== 1) {
    console.error('postsPerTransfer must be 1');
    process.exit(1);
  }

  const pick = pickTodayArticle(queue, todayYmd, { forceSlug, now });
  if (pick.error) {
    console.error(pick.error);
    process.exit(pick.exitCode);
  }

  const article = pick.article;
  if (!article) {
    console.log('No article due for transfer.', { todayYmd, channels: requestedChannels });
    process.exit(0);
  }

  console.log(
    `${dryRun ? '[dry-run] ' : ''}Processing ${article.slug} channels=[${requestedChannels.join(',')}]`
  );

  const { updated, results, exitCode, reason } = await processArticleChannels({
    article,
    queue,
    now,
    dryRun,
    requestedChannels,
    verifyArticleUrl,
    createBufferPost,
    getConfig: getBufferConfig,
    paths: {
      queue: PATHS.bufferQueue,
      publishedLog: PATHS.bufferPublishedLog,
      failedLog: PATHS.bufferFailedLog,
    },
  });

  for (const r of results) {
    const extra = [r.publishAt, r.dueAtUtc].filter(Boolean).join(' → ');
    console.log(' ', r.channel, r.action, r.reason || r.postId || r.error || '', extra ? `(${extra})` : '');
  }

  if (reason === 'url_unavailable') {
    console.log('[dry-run] Would set article_url_unavailable — no queue write');
    process.exit(dryRun ? 0 : 1);
  }

  if (updated) console.log('UPDATED=1');
  else console.log('UPDATED=0');

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
