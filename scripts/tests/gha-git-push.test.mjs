/**
 * Regression: 7a575ac deleted PR #5's scheduled Insights because gha-git-push
 * reset --mixed onto a newer origin and then git-added directories. Files that
 * landed after checkout were missing from the worktree, so they were staged
 * as deletions, and the stale schedule.json overwrite dropped their entries.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  discardedScheduleSlugs,
  evaluateSchedulePush,
  unpublishedScheduledDeletions,
} from '../lib/schedule-push-guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUSH = path.join(ROOT, 'scripts/lib/gha-git-push.sh');

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  GHA_GIT_PUSH_RETRY_SLEEP: '0',
  GITHUB_REF_NAME: 'main',
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'commit.gpgsign',
  GIT_CONFIG_VALUE_0: 'false',
};

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function setupRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gha-push-'));
  const bare = path.join(dir, 'bare.git');
  const worker = path.join(dir, 'worker');
  const other = path.join(dir, 'other');
  git(dir, ['init', '--bare', bare]);
  git(dir, ['clone', bare, worker]);
  git(worker, ['checkout', '-b', 'main']);
  write(path.join(worker, 'README.md'), 'base\n');
  git(worker, ['add', 'README.md']);
  git(worker, ['commit', '-m', 'base']);
  git(worker, ['push', '-u', 'origin', 'main']);
  git(dir, ['clone', bare, other]);
  return { dir, bare, worker, other };
}

function pushScript(worker, message, paths) {
  return spawnSync('bash', [PUSH, message, ...paths], {
    cwd: worker,
    env: GIT_ENV,
    encoding: 'utf8',
  });
}

function originSchedule(bare) {
  const raw = git(bare, ['show', 'main:insights/_scheduled/schedule.json']);
  return JSON.parse(raw);
}

test('discardedScheduleSlugs flags entries a stale rewrite omitted', () => {
  const upstream = {
    articles: [
      { slug: 'geo-social-citation-authority', status: 'scheduled' },
      { slug: 'gsc-multimodal-search-reporting', status: 'scheduled' },
      { slug: 'aio-external-link-ai-mode-rct', status: 'scheduled' },
      { slug: 'september-2026-spam-update', status: 'scheduled' },
      { slug: 'merchant-center-native-checkout-holiday', status: 'scheduled' },
      { slug: 'uk-cma-choice-screens-three-shelves', status: 'scheduled' },
    ],
  };
  const stalePublished = {
    articles: [{ slug: 'geo-social-citation-authority', status: 'published' }],
  };
  assert.deepEqual(discardedScheduleSlugs(upstream, stalePublished), [
    'gsc-multimodal-search-reporting',
    'aio-external-link-ai-mode-rct',
    'september-2026-spam-update',
    'merchant-center-native-checkout-holiday',
    'uk-cma-choice-screens-three-shelves',
  ]);
  assert.deepEqual(evaluateSchedulePush({
    upstream,
    result: stalePublished,
    stagedDeletions: [],
  }).ok, false);
});

test('unpublishedScheduledDeletions allows only the article this run published', () => {
  const result = {
    articles: [
      { slug: 'published-today', status: 'published' },
      { slug: 'still-scheduled', status: 'scheduled' },
    ],
  };
  assert.deepEqual(unpublishedScheduledDeletions([
    'insights/_scheduled/published-today/index.html',
    'insights/_scheduled/still-scheduled/index.html',
    'insights/_scheduled/proposals/2026-10-batch.schedule.patch',
  ], result), [
    'insights/_scheduled/still-scheduled/index.html',
  ]);
});

test('push script no longer replays a stale tree with reset --mixed', () => {
  const source = fs.readFileSync(PUSH, 'utf8');
  const executable = source.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');
  assert.doesNotMatch(executable, /reset --mixed/);
  assert.match(source, /exit 42/);
  const workflow = fs.readFileSync(
    path.join(ROOT, '.github/workflows/reconcile-publishing-pipeline.yml'),
    'utf8',
  );
  assert.match(workflow, /"\$code" -ne 42/);
  assert.match(workflow, /git reset --hard "origin\/\$\{branch\}"/);
});

test('7a575ac regression: stale publish cannot delete insights merged before push', () => {
  const { bare, worker, other } = setupRepo();
  const schedule = {
    articles: [
      { slug: 'due-article', status: 'scheduled', publishAt: '2026-09-25T10:00:00+09:00' },
    ],
  };
  write(path.join(worker, 'insights/_scheduled/schedule.json'), `${JSON.stringify(schedule, null, 2)}\n`);
  write(path.join(worker, 'insights/_scheduled/due-article/index.html'), '<p>due</p>\n');
  git(worker, ['add', 'insights']);
  git(worker, ['commit', '-m', 'schedule due article']);
  git(worker, ['push', 'origin', 'HEAD:main']);

  git(other, ['pull', 'origin', 'main']);
  const merged = {
    articles: [
      ...schedule.articles,
      { slug: 'gsc-multimodal-search-reporting', status: 'scheduled', publishAt: '2026-10-01T10:00:00+09:00' },
      { slug: 'aio-external-link-ai-mode-rct', status: 'scheduled', publishAt: '2026-10-02T10:00:00+09:00' },
      { slug: 'september-2026-spam-update', status: 'scheduled', publishAt: '2026-10-05T10:00:00+09:00' },
      { slug: 'merchant-center-native-checkout-holiday', status: 'scheduled', publishAt: '2026-10-06T10:00:00+09:00' },
      { slug: 'uk-cma-choice-screens-three-shelves', status: 'scheduled', publishAt: '2026-10-07T10:00:00+09:00' },
    ],
  };
  write(path.join(other, 'insights/_scheduled/schedule.json'), `${JSON.stringify(merged, null, 2)}\n`);
  for (const slug of merged.articles.slice(1).map((article) => article.slug)) {
    write(path.join(other, `insights/_scheduled/${slug}/index.html`), `<p>${slug}</p>\n`);
    write(path.join(other, `insights/_social/facebook/posts/${slug}.md`), `${slug}\n`);
  }
  write(path.join(other, 'insights/_scheduled/proposals/2026-10-batch.schedule.patch'), '# APPLIED\n');
  git(other, ['add', 'insights']);
  git(other, ['commit', '-m', 'Merge scheduled October insights']);
  git(other, ['push', 'origin', 'HEAD:main']);

  const stale = {
    articles: [
      { slug: 'due-article', status: 'published', publishAt: '2026-09-25T10:00:00+09:00' },
    ],
  };
  write(path.join(worker, 'insights/_scheduled/schedule.json'), `${JSON.stringify(stale, null, 2)}\n`);
  write(path.join(worker, 'insights/due-article/index.html'), '<p>published</p>\n');
  fs.rmSync(path.join(worker, 'insights/_scheduled/due-article'), { recursive: true, force: true });

  const pushed = pushScript(
    worker,
    'Reconcile Insights publication state',
    ['insights/', 'insights/_scheduled/', 'insights/_social/'],
  );
  assert.equal(pushed.status, 42, pushed.stderr);
  assert.match(pushed.stderr, /No commit was pushed/);

  const onOrigin = originSchedule(bare);
  assert.deepEqual(onOrigin.articles.map((article) => article.slug), merged.articles.map((article) => article.slug));
  for (const slug of merged.articles.slice(1).map((article) => article.slug)) {
    git(bare, ['cat-file', '-e', `main:insights/_scheduled/${slug}/index.html`]);
    git(bare, ['cat-file', '-e', `main:insights/_social/facebook/posts/${slug}.md`]);
  }
  git(bare, ['cat-file', '-e', 'main:insights/_scheduled/proposals/2026-10-batch.schedule.patch']);
  assert.equal(git(bare, ['log', '-1', '--format=%s', 'main']), 'Merge scheduled October insights');
});

test('concurrent files under the commit pathspec are kept when this run did not edit them', () => {
  const { bare, worker, other } = setupRepo();
  write(path.join(worker, 'insights/index.html'), '<p>old</p>\n');
  git(worker, ['add', 'insights/index.html']);
  git(worker, ['commit', '-m', 'index']);
  git(worker, ['push', 'origin', 'HEAD:main']);

  git(other, ['pull', 'origin', 'main']);
  write(path.join(other, 'insights/_scheduled/new-slug/index.html'), '<p>new</p>\n');
  git(other, ['add', 'insights/_scheduled/new-slug/index.html']);
  git(other, ['commit', '-m', 'add scheduled article']);
  git(other, ['push', 'origin', 'HEAD:main']);

  write(path.join(worker, 'insights/index.html'), '<p>published index</p>\n');
  const pushed = pushScript(worker, 'Publish scheduled Insights', ['insights/', 'insights/_scheduled/']);
  assert.equal(pushed.status, 0, `${pushed.stdout}\n${pushed.stderr}`);
  assert.equal(git(bare, ['show', 'main:insights/index.html']), '<p>published index</p>');
  git(bare, ['cat-file', '-e', 'main:insights/_scheduled/new-slug/index.html']);
  assert.match(git(bare, ['log', '-1', '--format=%s', 'main']), /Publish scheduled Insights/);
});

test('non-overlapping origin commits still receive this run\'s edits', () => {
  const { bare, worker, other } = setupRepo();
  write(path.join(worker, 'insights/_social/x-sidecar/ledger.json'), '{"n":1}\n');
  git(worker, ['add', 'insights/_social/x-sidecar/ledger.json']);
  git(worker, ['commit', '-m', 'ledger']);
  git(worker, ['push', 'origin', 'HEAD:main']);

  git(other, ['pull', 'origin', 'main']);
  write(path.join(other, 'README.md'), 'sidecar landed\n');
  git(other, ['add', 'README.md']);
  git(other, ['commit', '-m', 'unrelated']);
  git(other, ['push', 'origin', 'HEAD:main']);

  write(path.join(worker, 'insights/_social/x-sidecar/ledger.json'), '{"n":2}\n');
  const pushed = pushScript(
    worker,
    'chore(sidecar): update ledger and redirects [skip ci]',
    ['insights/_social/x-sidecar/ledger.json'],
  );
  assert.equal(pushed.status, 0, `${pushed.stdout}\n${pushed.stderr}`);
  assert.equal(git(bare, ['show', 'main:README.md']), 'sidecar landed');
  assert.equal(git(bare, ['show', 'main:insights/_social/x-sidecar/ledger.json']), '{"n":2}');
});

test('a run that actually publishes can remove that article\'s scheduled HTML', () => {
  const { bare, worker } = setupRepo();
  const schedule = {
    articles: [
      { slug: 'due-article', status: 'scheduled', publishAt: '2026-09-28T10:00:00+09:00' },
      { slug: 'tomorrow', status: 'scheduled', publishAt: '2026-09-29T10:00:00+09:00' },
    ],
  };
  write(path.join(worker, 'insights/_scheduled/schedule.json'), `${JSON.stringify(schedule, null, 2)}\n`);
  write(path.join(worker, 'insights/_scheduled/due-article/index.html'), '<p>due</p>\n');
  write(path.join(worker, 'insights/_scheduled/tomorrow/index.html'), '<p>tomorrow</p>\n');
  git(worker, ['add', 'insights']);
  git(worker, ['commit', '-m', 'two scheduled']);
  git(worker, ['push', 'origin', 'HEAD:main']);

  schedule.articles[0].status = 'published';
  write(path.join(worker, 'insights/_scheduled/schedule.json'), `${JSON.stringify(schedule, null, 2)}\n`);
  write(path.join(worker, 'insights/due-article/index.html'), '<p>live</p>\n');
  fs.rmSync(path.join(worker, 'insights/_scheduled/due-article'), { recursive: true, force: true });

  const pushed = pushScript(worker, 'Reconcile Insights publication state', ['insights/', 'insights/_scheduled/']);
  assert.equal(pushed.status, 0, `${pushed.stdout}\n${pushed.stderr}`);
  const onOrigin = originSchedule(bare);
  assert.equal(onOrigin.articles.find((article) => article.slug === 'due-article').status, 'published');
  assert.equal(onOrigin.articles.find((article) => article.slug === 'tomorrow').status, 'scheduled');
  assert.throws(() => git(bare, ['cat-file', '-e', 'main:insights/_scheduled/due-article/index.html']));
  git(bare, ['cat-file', '-e', 'main:insights/due-article/index.html']);
  git(bare, ['cat-file', '-e', 'main:insights/_scheduled/tomorrow/index.html']);
});

test('dropping a schedule entry this run did not publish is refused', () => {
  const { bare, worker } = setupRepo();
  const schedule = {
    articles: [
      { slug: 'keep-me', status: 'scheduled', publishAt: '2026-10-01T10:00:00+09:00' },
      { slug: 'due-article', status: 'scheduled', publishAt: '2026-09-28T10:00:00+09:00' },
    ],
  };
  write(path.join(worker, 'insights/_scheduled/schedule.json'), `${JSON.stringify(schedule, null, 2)}\n`);
  write(path.join(worker, 'insights/_scheduled/keep-me/index.html'), '<p>keep</p>\n');
  write(path.join(worker, 'insights/_scheduled/due-article/index.html'), '<p>due</p>\n');
  git(worker, ['add', 'insights']);
  git(worker, ['commit', '-m', 'scheduled']);
  git(worker, ['push', 'origin', 'HEAD:main']);

  write(path.join(worker, 'insights/_scheduled/schedule.json'), `${JSON.stringify({
    articles: [{ slug: 'due-article', status: 'published', publishAt: '2026-09-28T10:00:00+09:00' }],
  }, null, 2)}\n`);
  const pushed = pushScript(worker, 'Reconcile Insights publication state', ['insights/_scheduled/']);
  assert.equal(pushed.status, 42, pushed.stderr);
  assert.match(pushed.stderr, /keep-me/);
  assert.equal(originSchedule(bare).articles.map((article) => article.slug).join(','), 'keep-me,due-article');
});
