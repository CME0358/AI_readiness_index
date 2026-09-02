/**
 * Enroll published Insights (especially current-event) in LinkedIn + Buffer queues.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, ROOT, articleUrl } from './insights-v2-paths.mjs';
import { EDITORIAL_STATUSES } from './editorial-status.mjs';
import { articleTimesForPublishDay, toJstDateString } from './business-days.mjs';
import { buildChannelEntries } from './unlock-next-insight.mjs';
import { CHANNEL_KEYS, CHANNEL_CONTENT_DIRS } from './social-channels.mjs';
import { isSameBufferLedgerEntry, normalizePublicationDate } from './buffer-ledger.mjs';

export const V2_SOCIAL_QUEUE_BASE = 30;

export function isCurrentEventArticle(article) {
  return article?.series === 'current-event' || article?.editorialType === 'current_event';
}

export function countCurrentEventQueueExtras(schedule) {
  return schedule.articles.filter(
    (a) =>
      isCurrentEventArticle(a) &&
      (a.status === EDITORIAL_STATUSES.SCHEDULED || a.status === EDITORIAL_STATUSES.PUBLISHED)
  ).length;
}

export function expectedSocialQueuePostCount(schedule) {
  return V2_SOCIAL_QUEUE_BASE + countCurrentEventQueueExtras(schedule);
}

export function socialContentFilesExist(slug) {
  return CHANNEL_KEYS.every((ch) =>
    fs.existsSync(path.join(ROOT, CHANNEL_CONTENT_DIRS[ch], `${slug}.md`))
  );
}

function insertIndexByPublishAt(posts, publishAtIso) {
  const target = new Date(publishAtIso).getTime();
  const idx = posts.findIndex((p) => p.articlePublishAt && new Date(p.articlePublishAt).getTime() > target);
  return idx === -1 ? posts.length : idx;
}

/**
 * @returns {{ enrolled: boolean, slug?: string, reason?: string, insertIndex?: number }}
 */
export function enrollSocialOnPublish(article, { dryRun = false } = {}) {
  if (!article?.slug || !article.publishAt) {
    return { enrolled: false, reason: 'missing_slug_or_publishAt' };
  }

  if (!socialContentFilesExist(article.slug)) {
    return { enrolled: false, reason: 'missing_social_content_files', slug: article.slug };
  }

  const linkedinQueue = JSON.parse(fs.readFileSync(PATHS.linkedinQueue, 'utf8'));
  const publishYmd = toJstDateString(new Date(article.publishAt));
  if (linkedinQueue.posts.some((p) => p.slug === article.slug && normalizePublicationDate(p) === publishYmd)) {
    return { enrolled: false, reason: 'already_enrolled', slug: article.slug };
  }

  const times = articleTimesForPublishDay(publishYmd);
  const unlockedAt = new Date().toISOString();

  const liPost = {
    id: `ARI-LI-CE-${article.slug}-${publishYmd}`,
    slug: article.slug,
    articlePublishAt: times.web,
    bufferTransferAt: times.bufferTransfer,
    linkedinPublishAt: times.linkedin,
    articleUrl: articleUrl(article.slug),
    contentFile: `insights/_social/linkedin/posts/${article.slug}.md`,
    status: EDITORIAL_STATUSES.SCHEDULED,
    bufferUpdateId: null,
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    createdAt: unlockedAt,
    updatedAt: unlockedAt,
    series: article.series || 'current-event',
  };

  const idx = insertIndexByPublishAt(linkedinQueue.posts, times.web);
  linkedinQueue.posts.splice(idx, 0, liPost);

  if (fs.existsSync(PATHS.bufferQueue)) {
    const bufferQueue = JSON.parse(fs.readFileSync(PATHS.bufferQueue, 'utf8'));
    if (!bufferQueue.posts.some((p) => isSameBufferLedgerEntry(p, article.slug, publishYmd))) {
      bufferQueue.posts.splice(idx, 0, {
        slug: article.slug,
        articleUrl: articleUrl(article.slug),
        status: EDITORIAL_STATUSES.SCHEDULED,
        articlePublishAt: times.web,
        bufferTransferAt: times.bufferTransfer,
        channels: buildChannelEntries(article.slug, times),
        attempts: 0,
        lastAttemptAt: null,
        lastError: null,
        createdAt: unlockedAt,
        updatedAt: unlockedAt,
        series: article.series || 'current-event',
      });
      if (!dryRun) {
        fs.writeFileSync(PATHS.bufferQueue, JSON.stringify(bufferQueue, null, 2) + '\n', 'utf8');
      }
    }
  }

  if (!dryRun) {
    fs.writeFileSync(PATHS.linkedinQueue, JSON.stringify(linkedinQueue, null, 2) + '\n', 'utf8');
  }

  return { enrolled: true, slug: article.slug, insertIndex: idx };
}
