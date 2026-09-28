/**
 * Last line of defense for publish/reconcile pushes.
 *
 * A stale worker must not drop schedule.json entries, and must not delete
 * insights/_scheduled/<slug>/index.html unless this same run marked that
 * slug published (the scheduled package moved to insights/<slug>/).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function discardedScheduleSlugs(upstream, result) {
  const upstreamArticles = Array.isArray(upstream?.articles) ? upstream.articles : [];
  const resultSlugs = new Set(
    (Array.isArray(result?.articles) ? result.articles : [])
      .map((article) => article?.slug)
      .filter(Boolean),
  );
  return upstreamArticles
    .map((article) => article?.slug)
    .filter((slug) => slug && !resultSlugs.has(slug));
}

/**
 * Staged deletions of scheduled article HTML that this run did not publish.
 * @param {string[]} deletionPaths
 */
export function unpublishedScheduledDeletions(deletionPaths, result) {
  const bySlug = new Map(
    (Array.isArray(result?.articles) ? result.articles : [])
      .filter((article) => article?.slug)
      .map((article) => [article.slug, article]),
  );
  const bad = [];
  for (const filePath of deletionPaths || []) {
    const match = String(filePath).match(/^insights\/_scheduled\/([^/]+)\/index\.html$/);
    if (!match) continue;
    const entry = bySlug.get(match[1]);
    if (!entry || entry.status !== 'published') bad.push(String(filePath));
  }
  return bad;
}

export function evaluateSchedulePush({ upstream, result, stagedDeletions }) {
  const missing = discardedScheduleSlugs(upstream, result);
  const deletions = unpublishedScheduledDeletions(stagedDeletions, result);
  return {
    ok: missing.length === 0 && deletions.length === 0,
    missing,
    deletions,
  };
}

function readGitShow(spec) {
  try {
    return execFileSync('git', ['show', spec], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function readUpstreamSchedule() {
  const raw = readGitShow('HEAD:insights/_scheduled/schedule.json');
  if (!raw) return { articles: [] };
  return JSON.parse(raw);
}

function readResultSchedule() {
  const schedulePath = 'insights/_scheduled/schedule.json';
  if (!fs.existsSync(schedulePath)) return { articles: [] };
  return JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
}

function readStagedDeletions() {
  const raw = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=D'], {
    encoding: 'utf8',
  });
  return raw.split('\n').filter(Boolean);
}

function runCli() {
  const verdict = evaluateSchedulePush({
    upstream: readUpstreamSchedule(),
    result: readResultSchedule(),
    stagedDeletions: readStagedDeletions(),
  });
  if (verdict.ok) return;
  if (verdict.missing.length) {
    console.error(`schedule.json would drop entries: ${verdict.missing.join(', ')}`);
  }
  if (verdict.deletions.length) {
    console.error(
      `would delete scheduled articles this run did not publish: ${verdict.deletions.join(', ')}`,
    );
  }
  process.exit(2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
