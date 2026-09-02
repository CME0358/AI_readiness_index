#!/usr/bin/env node
/**
 * Daily multi-channel Buffer transfer (LinkedIn + Facebook + X).
 * One article per business day; per-channel idempotency via bufferUpdateId.
 *
 * Usage:
 *   node scripts/queue-daily-buffer-posts.mjs
 *   node scripts/queue-daily-buffer-posts.mjs --dry-run
 *   node scripts/queue-daily-buffer-posts.mjs --verified-only (compatibility flag; verification is always required)
 *   node scripts/queue-daily-buffer-posts.mjs --channels facebook,x
 *   node scripts/queue-daily-buffer-posts.mjs --force-slug ai-search-shift --channels facebook,x
 *   node scripts/queue-daily-buffer-posts.mjs --now 2026-08-04T12:00:00+09:00
 */
import fs from 'node:fs';
import { PATHS } from './lib/insights-v2-paths.mjs';
import { toJstDateString, isWeekday } from './lib/business-days.mjs';
import {
  createBufferPost,
  getBufferConfig,
} from './lib/buffer-client.mjs';
import { verifyArticleUrl } from './lib/url-verify.mjs';
import { verifyProductionSocialAssets, resolveCanonicalHero } from './lib/insights-social-media.mjs';
import { waitForArticleProduction } from './lib/wait-production-url.mjs';
import { CHANNEL_KEYS } from './lib/social-channels.mjs';
import { loadCanonicalBufferEnv } from './lib/buffer-env.mjs';
import {
  readJsonFile,
  pickTodayArticle,
  pickBufferEligibleArticle,
  processArticleChannels,
  parseChannelsArg,
} from './lib/buffer-dispatcher.mjs';

const dryRun = process.argv.includes('--dry-run');
const waitDeploy = process.argv.includes('--wait-deploy');
// Production verification is a hard handoff gate. Keep the legacy flag
// accepted for compatibility, but never permit an unverified transfer.
const verifiedOnly = true;
const forceSlug = (() => {
  const i = process.argv.indexOf('--force-slug');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const publicationDate = (() => {
  const i = process.argv.indexOf('--publication-date');
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
  loadCanonicalBufferEnv();
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

  const pick = verifiedOnly
    ? (() => {
        const schedule = JSON.parse(fs.readFileSync(PATHS.schedule, 'utf8'));
        const article = pickBufferEligibleArticle(queue, { forceSlug, publicationDate, schedule });
        if (forceSlug && !article) {
          return { error: `No verified buffer-eligible article for ${forceSlug}`, exitCode: 1 };
        }
        return { article };
      })()
    : pickTodayArticle(queue, todayYmd, { forceSlug, now });
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

  if (waitDeploy && !dryRun) {
    const prod = await waitForArticleProduction(article.slug, { verifyFn: verifyArticleUrl });
    if (!prod.ok) {
      console.error('Article URL not live after wait — aborting Buffer transfer');
      process.exit(1);
    }
    console.log('Article URL live:', prod.url);
  }

  const { updated, results, exitCode, reason } = await processArticleChannels({
    article,
    queue,
    now,
    dryRun,
    requestedChannels,
    verifyArticleUrl,
    verifyProduction: (slug) => verifyProductionSocialAssets(slug, { verifyArticle: verifyArticleUrl }),
    createBufferPost,
    getConfig: getBufferConfig,
    paths: {
      queue: PATHS.bufferQueue,
      publishedLog: PATHS.bufferPublishedLog,
      failedLog: PATHS.bufferFailedLog,
    },
  });

  if (dryRun) {
    const source = resolveCanonicalHero(article.slug);
    console.log('ARTICLE:', article.slug);
    console.log('HERO SOURCE:', source.publicUrl);
    console.log('PRODUCTION VERIFIED:', results.length ? results[0].mediaStatus !== 'text_only' || source.available === false : 'blocked');
    console.log('DERIVATIVE REQUIRED:', 'NO');
    console.log('DERIVATIVE PATH:', 'NONE');
    for (const ch of requestedChannels) {
      const result = results.find((r) => r.channel === ch);
      console.log(`${ch.toUpperCase()} ACTION:`, result?.action || 'skip');
    }
    console.log('CLEANUP ACTION:', 'NONE (canonical URL used; no temporary derivative)');
  }

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
