/**
 * Core multi-channel Buffer dispatcher logic (testable, no side effects in exports).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './insights-v2-paths.mjs';
import { toJstDateString, isWeekday, charCountNoSpace } from './business-days.mjs';
import { EDITORIAL_STATUSES } from './editorial-status.mjs';
import {
  CHANNEL_KEYS,
  CHANNEL_STATUSES,
  CONTENT_LIMITS,
  EXISTING_BUFFER_SENTINEL,
  parseChannelsArg,
  validateChannelKeys,
} from './social-channels.mjs';
import { resolvePublishAt, addMinutesJst, toBufferDueAt } from './social-schedule.mjs';
import { getChannelId, isChannelConfigured } from './buffer-client.mjs';

function resolveChannelPublishAt(ch, channel, article, now) {
  let publishAt = resolvePublishAt(channel.publishAt, now, 30);
  if (ch === 'x' && article.channels.facebook?.publishAt) {
    const fbResolved = resolvePublishAt(article.channels.facebook.publishAt, now, 30);
    const xMin = addMinutesJst(new Date(fbResolved), 15).iso;
    if (new Date(publishAt).getTime() < new Date(xMin).getTime()) {
      publishAt = xMin;
    }
  }
  return publishAt;
}

export function readJsonFile(p, fallback = null) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function writeJsonFile(p, data, { dryRun = false } = {}) {
  if (dryRun) return false;
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return true;
}

export function appendJsonLog(p, entry, { dryRun = false } = {}) {
  const log = readJsonFile(p, { entries: [], updatedAt: null });
  log.entries.push(entry);
  log.updatedAt = new Date().toISOString();
  writeJsonFile(p, log, { dryRun });
}

export function loadChannelText(contentFile) {
  const abs = path.isAbsolute(contentFile) ? contentFile : path.join(ROOT, contentFile);
  if (!fs.existsSync(abs)) throw new Error(`Missing content: ${abs}`);
  return fs.readFileSync(abs, 'utf8').trim();
}

export function validateChannelContent(channelKey, text, articleUrl) {
  const limits = CONTENT_LIMITS[channelKey];
  const len = text.length;
  const errors = [];

  if (!text.includes(articleUrl)) errors.push('URL missing');
  if (len < limits.min || len > limits.max) {
    errors.push(`length ${len} outside ${limits.min}-${limits.max}`);
  }
  const tags = (text.match(/#\w+/g) || []).length;
  if (tags < limits.hashtags[0] || tags > limits.hashtags[1]) {
    errors.push(`hashtag count ${tags} outside ${limits.hashtags.join('-')}`);
  }
  if (channelKey === 'linkedin' && !text.includes('#AgentReadiness')) {
    errors.push('missing #AgentReadiness');
  }

  return { ok: errors.length === 0, errors };
}

export function isChannelQueued(channel) {
  if (!channel) return false;
  if (channel.bufferUpdateId === EXISTING_BUFFER_SENTINEL) return true;
  if (channel.bufferUpdateId) return true;
  return channel.status === CHANNEL_STATUSES.QUEUED;
}

export function isChannelEligible(channel, { requestedChannels }) {
  if (!channel) return false;
  if (isChannelQueued(channel)) return false;
  if (channel.status === CHANNEL_STATUSES.SKIPPED) return false;
  const transferable = new Set([
    CHANNEL_STATUSES.SCHEDULED,
    CHANNEL_STATUSES.ARTICLE_PUBLISHED,
    CHANNEL_STATUSES.READY,
    CHANNEL_STATUSES.URL_UNAVAILABLE,
    CHANNEL_STATUSES.FAILED,
  ]);
  return transferable.has(channel.status);
}

export function pickTodayArticle(queue, todayYmd, { forceSlug = null, now = new Date() } = {}) {
  if (forceSlug) {
    const forced = queue.posts.find((p) => p.slug === forceSlug);
    if (forced?.status === EDITORIAL_STATUSES.HOLD) {
      return { error: `editorial_hold cannot be transferred: ${forceSlug}`, exitCode: 1 };
    }
  }

  const candidates = queue.posts.filter((p) => {
    if (forceSlug) return p.slug === forceSlug;
    if (p.status === EDITORIAL_STATUSES.HOLD) return false;
    if (!p.bufferTransferAt) return false;
    return toJstDateString(new Date(p.bufferTransferAt)) === todayYmd;
  });

  if (!candidates.length) return { article: null };

  const eligible = candidates.filter((p) => {
    if (p.status === EDITORIAL_STATUSES.HOLD) return false;
    const transferable = new Set([
      EDITORIAL_STATUSES.SCHEDULED,
      'article_published',
      'ready_for_buffer',
      'article_url_unavailable',
      'buffer_transfer_failed',
      'partially_queued',
      'buffer_queued',
    ]);
    if (!transferable.has(p.status)) return false;
    // Fully queued articles with no pending channels are done
    if (p.status === 'buffer_queued' && p.channels) {
      const pending = CHANNEL_KEYS.some((ch) => {
        const c = p.channels[ch];
        return c && isChannelEligible(c, { requestedChannels: CHANNEL_KEYS });
      });
      if (!pending) return false;
    }
    if (forceSlug) return p.slug === forceSlug;
    return true;
  });

  return { article: eligible[0] || null };
}

export function countPendingChannels(article, requestedChannels) {
  return requestedChannels.filter((ch) => {
    const c = article.channels?.[ch];
    return c && isChannelEligible(c, { requestedChannels });
  }).length;
}

/**
 * Process one article across channels. Mutates article in place unless dryRun.
 * @returns {Promise<{updated: boolean, results: object[], exitCode: number}>}
 */
export async function processArticleChannels({
  article,
  queue,
  now,
  dryRun,
  requestedChannels,
  verifyArticleUrl,
  createBufferPost,
  getConfig,
  paths,
}) {
  validateChannelKeys(requestedChannels);

  const verify = await verifyArticleUrl(article.slug);
  if (!verify.ok) {
    if (!dryRun) {
      article.status = 'article_url_unavailable';
      article.lastError = verify.reason;
      article.updatedAt = now.toISOString();
      for (const ch of requestedChannels) {
        const c = article.channels[ch];
        if (c && isChannelEligible(c, { requestedChannels })) {
          c.status = CHANNEL_STATUSES.URL_UNAVAILABLE;
          c.lastError = verify.reason;
        }
      }
      appendJsonLog(paths.failedLog, {
        at: now.toISOString(),
        slug: article.slug,
        error: verify.reason,
        dryRun,
      }, { dryRun });
      writeJsonFile(paths.queue, queue, { dryRun });
    }
    return { updated: !dryRun, results: [], exitCode: dryRun ? 0 : 1, reason: 'url_unavailable' };
  }

  const cfg = getConfig();
  const results = [];
  let anyUpdated = false;
  let anyFailed = false;

  for (const ch of requestedChannels) {
    const channel = article.channels?.[ch];
    if (!channel) {
      results.push({ channel: ch, action: 'skip', reason: 'no_channel_entry' });
      continue;
    }

    if (isChannelQueued(channel)) {
      results.push({ channel: ch, action: 'skip', reason: 'already_queued', bufferUpdateId: channel.bufferUpdateId });
      continue;
    }

    if (!isChannelEligible(channel, { requestedChannels })) {
      results.push({ channel: ch, action: 'skip', reason: `status_${channel.status}` });
      continue;
    }

    if (!isChannelConfigured(ch, cfg)) {
      if (dryRun) {
        const publishAt = resolveChannelPublishAt(ch, channel, article, now);
        results.push({
          channel: ch,
          action: 'dry_run',
          postId: 'dry-run-mock-id',
          publishAt,
          dueAtUtc: toBufferDueAt(publishAt),
        });
        continue;
      }
      channel.status = CHANNEL_STATUSES.MANUAL;
      channel.lastError = `Missing env ${channel.channelIdEnv}`;
      channel.lastAttemptAt = now.toISOString();
      results.push({ channel: ch, action: 'skip', reason: 'missing_credentials' });
      continue;
    }

    let text;
    try {
      text = loadChannelText(channel.contentFile);
    } catch (err) {
      channel.status = CHANNEL_STATUSES.FAILED;
      channel.lastError = String(err.message);
      channel.attempts = (channel.attempts || 0) + 1;
      channel.lastAttemptAt = now.toISOString();
      anyFailed = true;
      results.push({ channel: ch, action: 'error', error: channel.lastError });
      continue;
    }

    const contentCheck = validateChannelContent(ch, text, article.articleUrl);
    if (!contentCheck.ok) {
      channel.status = CHANNEL_STATUSES.FAILED;
      channel.lastError = contentCheck.errors.join('; ');
      channel.attempts = (channel.attempts || 0) + 1;
      channel.lastAttemptAt = now.toISOString();
      anyFailed = true;
      results.push({ channel: ch, action: 'error', error: channel.lastError });
      continue;
    }

    const publishAt = resolveChannelPublishAt(ch, channel, article, now);
    const channelId = getChannelId(ch, cfg);

    const { postId, error, rejected, dueAtUtc } = await createBufferPost({
      channelKey: ch,
      channelId,
      accessToken: cfg.accessToken,
      text,
      dueAt: publishAt,
      dryRun,
    });

    channel.lastAttemptAt = now.toISOString();
    channel.attempts = (channel.attempts || 0) + 1;

    if (error) {
      channel.status = rejected ? CHANNEL_STATUSES.REJECTED : CHANNEL_STATUSES.FAILED;
      channel.lastError = error;
      anyFailed = true;
      results.push({ channel: ch, action: 'failed', error });
      if (!dryRun) {
        appendJsonLog(paths.failedLog, {
          at: now.toISOString(),
          slug: article.slug,
          channel: ch,
          error,
          dryRun,
        }, { dryRun });
      }
      continue;
    }

    if (!dryRun) {
      channel.bufferUpdateId = postId;
      channel.status = CHANNEL_STATUSES.QUEUED;
      channel.publishAt = publishAt;
      channel.lastError = null;
      channel.updatedAt = now.toISOString();
      anyUpdated = true;
      appendJsonLog(paths.publishedLog, {
        at: now.toISOString(),
        slug: article.slug,
        channel: ch,
        bufferUpdateId: postId,
        publishAt,
        dueAtUtc,
        dryRun,
      }, { dryRun });
    }

    results.push({
      channel: ch,
      action: dryRun ? 'dry_run' : 'queued',
      postId,
      publishAt,
      dueAtUtc,
    });
  }

  if (!dryRun && anyUpdated) {
    const allQueued = CHANNEL_KEYS.every((ch) => {
      const c = article.channels?.[ch];
      return !c || isChannelQueued(c) || c.status === CHANNEL_STATUSES.SKIPPED;
    });
    const anyPending = CHANNEL_KEYS.some((ch) => {
      const c = article.channels?.[ch];
      return c && isChannelEligible(c, { requestedChannels: CHANNEL_KEYS });
    });

    if (allQueued && !anyPending) {
      article.status = 'buffer_queued';
    } else if (anyUpdated) {
      article.status = 'partially_queued';
    }
    article.updatedAt = now.toISOString();
    writeJsonFile(paths.queue, queue, { dryRun });
  }

  return {
    updated: anyUpdated,
    results,
    exitCode: anyFailed && !dryRun ? 1 : 0,
  };
}

export { parseChannelsArg, validateChannelKeys, charCountNoSpace };
