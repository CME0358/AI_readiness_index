/**
 * Production-path simulation — unattended cycle timeline without live mutations.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractDueArticles, selectNextDueArticle } from '../lib/editorial-status.mjs';
import { EDITORIAL_STATUSES } from '../lib/editorial-status.mjs';
import { discoverCandidates } from '../lib/local-visual-worker.mjs';
import { configFor } from '../lib/local-visual-worker.mjs';
import { execFileSync } from 'node:child_process';
import { deriveScheduleOperationalState, OPERATIONAL_STATES } from '../lib/publishing-state-machine.mjs';
import { handlePublishInsightsCron } from '../lib/github-workflow-dispatch.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLISH_DAY = '2026-09-04';
const scheduledArticle = {
  slug: 'sim-article',
  status: EDITORIAL_STATUSES.SCHEDULED,
  publishAt: `${PUBLISH_DAY}T10:00:00+09:00`,
  title: 'Simulation article',
};

function jst(ymd, hm) {
  return new Date(`${ymd}T${hm}:00+09:00`);
}

test('09:55 reconcile does not publish before 10:00 JST', async () => {
  const due = extractDueArticles([scheduledArticle], jst(PUBLISH_DAY, '09:55'));
  assert.deepEqual(due, []);
  assert.equal(selectNextDueArticle([scheduledArticle], jst(PUBLISH_DAY, '09:55')), null);
});

test('10:00 reconcile selects exactly one publication candidate', () => {
  const now = jst(PUBLISH_DAY, '10:00');
  const due = extractDueArticles([scheduledArticle], now);
  assert.equal(due.length, 1);
  assert.equal(selectNextDueArticle([scheduledArticle], now).slug, 'sim-article');
});

test('10:10 and 10:20 repeated reconcile do not re-select published article', () => {
  const published = {
    ...scheduledArticle,
    status: EDITORIAL_STATUSES.PUBLISHED,
    publishedAt: `${PUBLISH_DAY}T01:00:00.000Z`,
  };
  assert.equal(selectNextDueArticle([published], jst(PUBLISH_DAY, '10:10')), null);
  assert.equal(selectNextDueArticle([published], jst(PUBLISH_DAY, '10:20')), null);
  assert.equal(
    deriveScheduleOperationalState(published, { now: jst(PUBLISH_DAY, '10:20') }),
    OPERATIONAL_STATES.VERIFICATION_PENDING,
  );
});

test('Vercel cron dispatches reconcile with authoritative 10:00 JST now input', async () => {
  const monday = new Date('2026-09-04T00:05:00.000Z');
  let capturedNow = null;
  const { status, body } = await handlePublishInsightsCron(
    { headers: { authorization: 'Bearer cron-secret' } },
    {
      CRON_SECRET: 'cron-secret',
      GITHUB_DISPATCH_TOKEN: 'ghp_test',
      now: monday,
      fetchImpl: async (_url, init) => {
        capturedNow = JSON.parse(init.body).inputs.now;
        return { status: 204, json: async () => ({}) };
      },
    },
  );
  assert.equal(status, 200);
  assert.equal(body.dispatched, true);
  assert.equal(capturedNow, `${PUBLISH_DAY}T10:00:00+09:00`);
});

test('visual worker later slots are idempotent when hero already exists', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-prod-path-vw-'));
  fs.mkdirSync(path.join(root, 'insights/_scheduled'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets/insights/sim-article'), { recursive: true });
  fs.writeFileSync(path.join(root, 'ARI_INSIGHTS_VISUAL_CANON.md'), 'TYPOGRAPHIC MODE ONLY');
  fs.writeFileSync(path.join(root, 'insights/_scheduled/schedule.json'), JSON.stringify({
    articles: [{ slug: 'sim-article', status: 'published', publishedAt: `${PUBLISH_DAY}T01:00:00.000Z`, title: 'Sim' }],
  }));
  fs.mkdirSync(path.join(root, 'insights/sim-article'), { recursive: true });
  fs.writeFileSync(path.join(root, 'insights/sim-article/index.html'), '<meta name="twitter:card" content="summary_large_image">\n<article class="article-body container">');
  fs.writeFileSync(path.join(root, 'assets/insights/sim-article/hero.webp'), 'webp');
  fs.writeFileSync(path.join(root, 'insights/index.html'), '<a class="insight-card" href="/insights/sim-article/" data-insight-slug="sim-article"></a>');

  execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD'], { cwd: root });

  const config = configFor(root, {
    logDir: path.join(root, 'logs'),
    lockPath: path.join(root, 'worker.lock'),
    origin: 'https://example.test',
  });

  for (const minute of ['05', '20', '35']) {
    const discovered = await discoverCandidates(config, {
      productionCheck: async () => ({ ok: true, status: 200 }),
    });
    assert.equal(discovered.candidates.length, 0, `expected NO_CANDIDATE at 10:${minute}`);
  }
  fs.rmSync(root, { recursive: true, force: true });
});

test('production-path dry reconcile entrypoint accepts timeline now flags', () => {
  const out = execFileSync(
    'node',
    [
      path.join(ROOT, 'scripts/reconcile-publishing-pipeline.mjs'),
      '--dry-run',
      '--skip-verify',
      '--skip-buffer',
      '--now',
      `${PUBLISH_DAY}T09:55:00+09:00`,
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.match(out, /"publish"/);
});
