/**
 * Apply emergency editorial insertion (ESB) with schedule, queues, and index updates.
 * Hero generation is triggered separately after schedule persistence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, articleUrl, ROOT } from './insights-v2-paths.mjs';
import { EDITORIAL_STATUSES } from './editorial-status.mjs';
import {
  applyEmergencyInsertion,
  publicationIdFor,
  SLOT_TYPES,
} from './editorial-schedule-buffer.mjs';
import { articleTimesForPublishDay } from './business-days.mjs';
import { prepareScheduledArticle } from './prepare-scheduled-article.mjs';
import { markHeroPending } from './insights-package-readiness.mjs';
import {
  buildChannelEntries,
  upsertPlannedCard,
} from './unlock-next-insight.mjs';
import { isSameBufferLedgerEntry, normalizePublicationDate } from './buffer-ledger.mjs';
import { triggerImmediatePrepublishHero } from './trigger-immediate-prepublish-hero.mjs';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function updateQueueDates(post, publishYmd) {
  if (!post) return;
  const times = articleTimesForPublishDay(publishYmd);
  post.articlePublishAt = times.web;
  post.bufferTransferAt = times.bufferTransfer;
  if (post.linkedinPublishAt !== undefined) post.linkedinPublishAt = times.linkedin;
  post.articleUrl = articleUrl(post.slug);
  if (!post.bufferUpdateId && post.status !== EDITORIAL_STATUSES.PUBLISHED) {
    post.status = EDITORIAL_STATUSES.SCHEDULED;
  }
  post.updatedAt = new Date().toISOString();
  if (post.channels) {
    post.channels = buildChannelEntries(post.slug, times);
  }
}

/**
 * @param {object} options
 * @param {string} options.slug
 * @param {string} options.targetDate YYYY-MM-DD
 * @param {object} options.scheduleMetadata Full schedule entry fields for the inserted article
 * @param {boolean} [options.dryRun]
 * @param {boolean} [options.triggerHero]
 * @param {string} [options.root]
 */
export function applyEmergencyEditorialInsert({
  slug,
  targetDate,
  scheduleMetadata,
  dryRun = false,
  triggerHero = true,
  root = ROOT,
} = {}) {
  const paths = {
    schedule: path.join(root, 'insights/_scheduled/schedule.json'),
    linkedinQueue: path.join(root, 'insights/_social/linkedin/queue.json'),
    bufferQueue: path.join(root, 'insights/_social/buffer/queue.json'),
    insightsIndex: path.join(root, 'insights/index.html'),
    reportsDir: path.join(root, 'reports'),
  };

  const bufferQueue = fs.existsSync(paths.bufferQueue)
    ? readJson(paths.bufferQueue)
    : { posts: [] };

  const plan = applyEmergencyInsertion({
    schedulePath: paths.schedule,
    slug,
    targetDate,
    slotType: SLOT_TYPES.DAILY_PRIMARY,
    bufferQueue: bufferQueue.posts,
    dryRun: true,
  });

  if (!plan.safe) {
    return { ok: false, plan, reason: plan.reason };
  }

  if (dryRun) {
    return { ok: true, dryRun: true, plan };
  }

  applyEmergencyInsertion({
    schedulePath: paths.schedule,
    slug,
    targetDate,
    slotType: SLOT_TYPES.DAILY_PRIMARY,
    bufferQueue: bufferQueue.posts,
    dryRun: false,
  });

  const schedule = readJson(paths.schedule);
  const times = articleTimesForPublishDay(targetDate);
  const now = new Date();

  let entry = schedule.articles.find((a) => a.slug === slug && a.publishAt?.slice(0, 10) === targetDate);
  if (!entry) {
    entry = {
      slug,
      status: EDITORIAL_STATUSES.SCHEDULED,
      publishAt: times.web,
      publicationId: publicationIdFor(targetDate),
      slotDate: targetDate,
      slotType: SLOT_TYPES.DAILY_PRIMARY,
    };
    schedule.articles.push(entry);
  }
  Object.assign(entry, scheduleMetadata, {
    slug,
    status: EDITORIAL_STATUSES.SCHEDULED,
    publishAt: times.web,
    slotDate: targetDate,
    slotType: SLOT_TYPES.DAILY_PRIMARY,
    publicationId: entry.publicationId || publicationIdFor(targetDate),
    unlockedAt: entry.unlockedAt || now.toISOString(),
  });
  markHeroPending(entry, { now });

  const linkedinQueue = readJson(paths.linkedinQueue);
  const bufQueue = readJson(paths.bufferQueue);

  for (const shift of plan.displaced || []) {
    const displaced = schedule.articles.find((a) => a.slug === shift.slug);
    if (!displaced) continue;
    const shiftedTimes = articleTimesForPublishDay(shift.to);

    const liPost = linkedinQueue.posts.find((p) => p.slug === shift.slug);
    if (liPost) {
      liPost.articlePublishAt = shiftedTimes.web;
      liPost.bufferTransferAt = shiftedTimes.bufferTransfer;
      liPost.linkedinPublishAt = shiftedTimes.linkedin;
      liPost.articleUrl = articleUrl(shift.slug);
      liPost.updatedAt = now.toISOString();
    }

    const bufPost = bufQueue.posts.find((p) =>
      p.slug === shift.slug && (!p.articlePublishAt || normalizePublicationDate(p) === shift.from));
    if (bufPost) {
      updateQueueDates(bufPost, shift.to);
    }
  }
  writeJson(paths.linkedinQueue, linkedinQueue);

  let liPost = linkedinQueue.posts.find((p) => p.slug === slug);
  if (!liPost) {
    liPost = {
      id: `ARI-LI-BREAK-${slug}`,
      slug,
      articlePublishAt: times.web,
      bufferTransferAt: times.bufferTransfer,
      linkedinPublishAt: times.linkedin,
      articleUrl: articleUrl(slug),
      contentFile: `insights/_social/linkedin/posts/${slug}.md`,
      status: EDITORIAL_STATUSES.SCHEDULED,
      bufferUpdateId: null,
      attempts: 0,
      lastAttemptAt: null,
      lastError: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      series: scheduleMetadata.series || 'current-event',
    };
    linkedinQueue.posts.push(liPost);
  } else {
    updateQueueDates(liPost, targetDate);
    liPost.contentFile = liPost.contentFile || `insights/_social/linkedin/posts/${slug}.md`;
    liPost.series = scheduleMetadata.series || liPost.series || 'current-event';
  }
  writeJson(paths.linkedinQueue, linkedinQueue);

  let bufPost = bufQueue.posts.find((p) => isSameBufferLedgerEntry(p, slug, targetDate) || (p.slug === slug && !p.articlePublishAt));
  if (!bufPost) {
    bufPost = {
      slug,
      articleUrl: articleUrl(slug),
      status: EDITORIAL_STATUSES.SCHEDULED,
      articlePublishAt: times.web,
      bufferTransferAt: times.bufferTransfer,
      channels: buildChannelEntries(slug, times),
      attempts: 0,
      lastAttemptAt: null,
      lastError: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      series: scheduleMetadata.series || 'current-event',
      unlockedAt: now.toISOString(),
    };
    bufQueue.posts.push(bufPost);
  } else {
    updateQueueDates(bufPost, targetDate);
    bufPost.series = scheduleMetadata.series || bufPost.series || 'current-event';
    bufPost.unlockedAt = now.toISOString();
  }
  writeJson(paths.bufferQueue, bufQueue);

  writeJson(paths.schedule, schedule);

  const prepared = prepareScheduledArticle(slug, { strict: true });
  if (!prepared.ok) {
    return { ok: false, reason: `prepare_failed:${prepared.error}`, prepared, plan };
  }

  let indexHtml = fs.readFileSync(paths.insightsIndex, 'utf8');
  indexHtml = upsertPlannedCard(indexHtml, entry, schedule);
  fs.writeFileSync(paths.insightsIndex, indexHtml, 'utf8');

  fs.mkdirSync(paths.reportsDir, { recursive: true });
  const report = {
    appliedAt: now.toISOString(),
    slug,
    targetDate,
    displaced: plan.displaced,
    bufferImpact: plan.bufferImpact,
    heroImpact: plan.heroImpact,
    packageReadiness: entry.packageReadiness,
  };
  writeJson(path.join(paths.reportsDir, 'emergency-editorial-insert.json'), report);

  let heroTrigger = null;
  if (triggerHero) {
    heroTrigger = triggerImmediatePrepublishHero({ root });
  }

  return {
    ok: true,
    slug,
    targetDate,
    displaced: plan.displaced,
    prepared,
    packageReadiness: entry.packageReadiness,
    heroTrigger,
    report,
  };
}
