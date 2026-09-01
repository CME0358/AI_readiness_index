#!/usr/bin/env node
/**
 * Initialize or refresh insights/_social/buffer/queue.json from schedule + LinkedIn queue.
 * Marks ai-search-shift LinkedIn as pre-existing (do not re-send).
 *
 * Usage:
 *   node scripts/init-buffer-queue.mjs
 *   node scripts/init-buffer-queue.mjs --protect-linkedin ai-search-shift
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, ROOT, articleUrl } from './lib/insights-v2-paths.mjs';
import { EDITORIAL_STATUSES, INITIAL_SLUG } from './lib/editorial-status.mjs';
import {
  CHANNEL_KEYS,
  CHANNEL_ENV,
  CHANNEL_CONTENT_DIRS,
  CHANNEL_STATUSES,
  EXISTING_BUFFER_SENTINEL,
} from './lib/social-channels.mjs';
import {
  defaultArticleTimes,
  hmToIso,
  ymdJst,
  resolvePublishAt,
} from './lib/social-schedule.mjs';
import { toJstDateString } from './lib/business-days.mjs';
import { normalizePublicationDate } from './lib/buffer-ledger.mjs';

const protectLinkedInSlug = (() => {
  const i = process.argv.indexOf('--protect-linkedin');
  return i >= 0 ? process.argv[i + 1] : INITIAL_SLUG;
})();

function channelEntry(slug, ch, publishAt, { protectLinkedIn = false } = {}) {
  const entry = {
    channelIdEnv: CHANNEL_ENV[ch],
    contentFile: `${CHANNEL_CONTENT_DIRS[ch]}/${slug}.md`,
    publishAt,
    status: CHANNEL_STATUSES.SCHEDULED,
    bufferUpdateId: null,
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    updatedAt: new Date().toISOString(),
  };

  if (ch === 'linkedin' && slug === protectLinkedInSlug && protectLinkedIn) {
    entry.status = CHANNEL_STATUSES.QUEUED;
    entry.bufferUpdateId = EXISTING_BUFFER_SENTINEL;
    entry.lastError = null;
  }

  return entry;
}

function buildPostFromLinkedIn(liPost, scheduleArticle, { protectLinkedIn = false } = {}) {
  const slug = liPost.slug;
  let articlePublishAt = liPost.articlePublishAt;
  let bufferTransferAt = liPost.bufferTransferAt;
  const channels = {};

  if (articlePublishAt && bufferTransferAt) {
    const ymd = toJstDateString(new Date(articlePublishAt));
    const defaultTimes = defaultArticleTimes(ymd);
    const linkedinAt = liPost.linkedinPublishAt || defaultTimes.channels.linkedin;
    channels.linkedin = channelEntry(slug, 'linkedin', linkedinAt, { protectLinkedIn });
    channels.facebook = channelEntry(slug, 'facebook', defaultTimes.channels.facebook);
    channels.x = channelEntry(slug, 'x', defaultTimes.channels.x);

    // Same-day override: align facebook/x with linkedin day if custom times
    if (liPost.linkedinPublishAt) {
      const liYmd = toJstDateString(new Date(liPost.linkedinPublishAt));
      if (liYmd === ymd) {
        channels.facebook.publishAt = hmToIso(ymd, '11:45');
        channels.x.publishAt = hmToIso(ymd, '12:00');
        if (liPost.linkedinPublishAt.includes('12:00')) {
          channels.facebook.publishAt = hmToIso(ymd, '12:15');
          channels.x.publishAt = hmToIso(ymd, '12:30');
        }
      }
    }
  } else {
    for (const ch of CHANNEL_KEYS) {
      channels[ch] = channelEntry(slug, ch, null);
      channels[ch].status = liPost.status === EDITORIAL_STATUSES.HOLD ? CHANNEL_STATUSES.SCHEDULED : CHANNEL_STATUSES.SCHEDULED;
    }
  }

  return {
    slug,
    publicationDate: normalizePublicationDate({ articlePublishAt }),
    articleUrl: liPost.articleUrl || articleUrl(slug),
    status: liPost.status,
    articlePublishAt,
    bufferTransferAt,
    channels,
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    createdAt: liPost.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function bumpPastTimes(post, now) {
  if (!post.articlePublishAt) return;
  for (const ch of CHANNEL_KEYS) {
    const c = post.channels[ch];
    if (!c?.publishAt) continue;
    if (c.bufferUpdateId === EXISTING_BUFFER_SENTINEL) continue;
    c.publishAt = resolvePublishAt(c.publishAt, now, 30);
  }
}

function main() {
  const linkedinQueue = JSON.parse(fs.readFileSync(PATHS.linkedinQueue, 'utf8'));
  const existing = fs.existsSync(PATHS.bufferQueue)
    ? JSON.parse(fs.readFileSync(PATHS.bufferQueue, 'utf8'))
    : null;

  const posts = linkedinQueue.posts.map((li) => {
    const built = buildPostFromLinkedIn(li, null, {
      protectLinkedIn: li.slug === protectLinkedInSlug,
    });

    // Preserve per-channel bufferUpdateId from existing queue
    if (existing) {
      const publicationDate = normalizePublicationDate(built);
      const prev = existing.posts.find((p) => p.slug === li.slug && normalizePublicationDate(p) === publicationDate);
      if (prev?.channels) {
        for (const ch of CHANNEL_KEYS) {
          if (prev.channels[ch]?.bufferUpdateId) {
            built.channels[ch] = { ...built.channels[ch], ...prev.channels[ch] };
          }
        }
      }
    }

    return built;
  });

  // Derive article-level status from channel states
  for (const p of posts) {
    if (p.status === EDITORIAL_STATUSES.HOLD) continue;
    const chs = Object.values(p.channels || {});
    const allQueued = chs.length > 0 && chs.every((c) => c.bufferUpdateId || c.status === CHANNEL_STATUSES.QUEUED);
    const anyQueued = chs.some((c) => c.bufferUpdateId || c.status === CHANNEL_STATUSES.QUEUED);
    const anyPending = chs.some((c) => !c.bufferUpdateId && c.status !== CHANNEL_STATUSES.QUEUED);
    if (allQueued && !anyPending) p.status = 'buffer_queued';
    else if (anyQueued && anyPending) p.status = 'partially_queued';
    else if (p.articlePublishAt) p.status = EDITORIAL_STATUSES.SCHEDULED;
  }

  const now = new Date();
  for (const p of posts) {
    if (p.slug === INITIAL_SLUG && p.status === EDITORIAL_STATUSES.SCHEDULED) {
      bumpPastTimes(p, now);
    }
  }

  const bufferQueue = {
    timezone: 'Asia/Tokyo',
    policy: {
      provider: 'buffer',
      transferMode: 'daily',
      postsPerTransfer: 1,
      channelsPerArticle: 3,
      weekdaysOnly: true,
      articlePublishTime: '10:00',
      bufferTransferTime: '10:30',
      channelPublishTimes: {
        linkedin: '11:30',
        facebook: '11:45',
        x: '12:00',
      },
    },
    posts,
  };

  fs.mkdirSync(path.dirname(PATHS.bufferQueue), { recursive: true });
  fs.mkdirSync(PATHS.bufferPublishedLog.replace(/[^/]+$/, ''), { recursive: true });

  fs.writeFileSync(PATHS.bufferQueue, JSON.stringify(bufferQueue, null, 2) + '\n', 'utf8');

  if (!fs.existsSync(PATHS.bufferPublishedLog)) {
    fs.writeFileSync(PATHS.bufferPublishedLog, JSON.stringify({ entries: [], updatedAt: null }, null, 2) + '\n');
  }
  if (!fs.existsSync(PATHS.bufferFailedLog)) {
    fs.writeFileSync(PATHS.bufferFailedLog, JSON.stringify({ entries: [], updatedAt: null }, null, 2) + '\n');
  }

  // Protect LinkedIn in legacy queue too (bufferUpdateId only — keep status scheduled)
  const liQueue = JSON.parse(fs.readFileSync(PATHS.linkedinQueue, 'utf8'));
  for (const p of liQueue.posts) {
    if (p.slug === protectLinkedInSlug) {
      p.bufferUpdateId = EXISTING_BUFFER_SENTINEL;
      if (p.status === 'buffer_queued') p.status = EDITORIAL_STATUSES.SCHEDULED;
      p.updatedAt = new Date().toISOString();
    }
  }
  fs.writeFileSync(PATHS.linkedinQueue, JSON.stringify(liQueue, null, 2) + '\n', 'utf8');

  console.log('Buffer queue initialized:', posts.length, 'posts');
  console.log('LinkedIn protected for:', protectLinkedInSlug);
}

main();
