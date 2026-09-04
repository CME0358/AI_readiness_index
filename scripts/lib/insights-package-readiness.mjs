/**
 * Scheduled Insight package readiness — minimal state semantics.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, ROOT } from './insights-v2-paths.mjs';
import { EDITORIAL_STATUSES } from './editorial-status.mjs';

export const PACKAGE_STATES = Object.freeze({
  ARTICLE_READY: 'ARTICLE_READY',
  HERO_PENDING: 'HERO_PENDING',
  HERO_READY: 'HERO_READY',
  PACKAGE_READY: 'PACKAGE_READY',
});

export function canonicalHeroPath(slug, root = ROOT) {
  return path.join(root, 'assets/insights', slug, 'hero.webp');
}

export function heroExists(slug, root = ROOT) {
  return fs.existsSync(canonicalHeroPath(slug, root));
}

export function scheduledArticlePath(slug, root = ROOT) {
  return path.join(root, 'insights/_scheduled', slug, 'index.html');
}

export function isFutureScheduledArticle(entry, now = new Date()) {
  return entry?.status === EDITORIAL_STATUSES.SCHEDULED &&
    entry.publishAt &&
    new Date(entry.publishAt).getTime() > now.getTime();
}

export function resolvePackageState(entry, { now = new Date(), root = ROOT } = {}) {
  if (!entry?.slug) return null;
  if (entry.status === EDITORIAL_STATUSES.HOLD) return null;
  const hasHero = heroExists(entry.slug, root);
  if (hasHero) {
    if (entry.status === EDITORIAL_STATUSES.SCHEDULED && isFutureScheduledArticle(entry, now)) {
      return PACKAGE_STATES.PACKAGE_READY;
    }
    return PACKAGE_STATES.HERO_READY;
  }
  if (entry.status === EDITORIAL_STATUSES.SCHEDULED) {
    return PACKAGE_STATES.HERO_PENDING;
  }
  return PACKAGE_STATES.ARTICLE_READY;
}

export function markHeroPending(entry, { now = new Date() } = {}) {
  if (!entry) return;
  entry.packageReadiness = PACKAGE_STATES.HERO_PENDING;
  entry.heroPendingAt = entry.heroPendingAt || now.toISOString();
}

export function markHeroReady(entry, { now = new Date() } = {}) {
  if (!entry) return;
  entry.packageReadiness = PACKAGE_STATES.PACKAGE_READY;
  entry.heroReadyAt = now.toISOString();
  delete entry.heroPendingAt;
}

export function loadSchedule(schedulePath = PATHS.schedule) {
  return JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
}

export function saveSchedule(schedule, schedulePath = PATHS.schedule) {
  fs.writeFileSync(schedulePath, JSON.stringify(schedule, null, 2) + '\n', 'utf8');
}

export function findNextPrepublishCandidate(schedule, { now = new Date(), root = ROOT } = {}) {
  const candidates = (schedule.articles || [])
    .filter((entry) => isFutureScheduledArticle(entry, now))
    .filter((entry) => !heroExists(entry.slug, root))
    .filter((entry) => fs.existsSync(scheduledArticlePath(entry.slug, root)))
    .sort((a, b) => new Date(a.publishAt).getTime() - new Date(b.publishAt).getTime());
  return candidates[0] || null;
}

export function findTodayScheduledArticle(schedule, { now = new Date() } = {}) {
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
  return (schedule.articles || []).find(
    (entry) => entry.status === EDITORIAL_STATUSES.SCHEDULED && entry.publishAt?.slice(0, 10) === today,
  ) || null;
}

export function evaluateMorningPreflight({ now = new Date(), root = ROOT, schedule = loadSchedule() } = {}) {
  const today = findTodayScheduledArticle(schedule, { now });
  if (!today) {
    return { ok: true, status: 'NO_TODAY_PUBLICATION', today: null };
  }
  const hasHero = heroExists(today.slug, root);
  const packageState = resolvePackageState(today, { now, root });
  const classification = hasHero ? 'PACKAGE_READY' : 'PREPUBLISH_HERO_MISSING';
  return {
    ok: hasHero,
    status: classification,
    slug: today.slug,
    title: today.title,
    publishAt: today.publishAt,
    packageState,
    articleReady: fs.existsSync(scheduledArticlePath(today.slug, root)),
    heroReady: hasHero,
    publicationEventReady: today.status === EDITORIAL_STATUSES.SCHEDULED,
    packageReady: hasHero,
  };
}
