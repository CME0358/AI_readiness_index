import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SYNC_SCRIPT = path.join(ROOT, 'scripts/sync-visual-worker-workspace.sh');

function runtimeFixture({ remoteUrl = 'https://github.com/CoaRetail/AI_readiness_index.git', includeMarker = true } = {}) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-visual-runtime-'));
  execFileSync('git', ['init', '-b', 'main'], { cwd: workspace, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: workspace });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: workspace });
  if (includeMarker) {
    fs.writeFileSync(path.join(workspace, '.ari-visual-worker-runtime'), 'disposable-runtime-clone\n');
  }
  fs.writeFileSync(path.join(workspace, 'README.md'), 'fixture');
  execFileSync('git', ['remote', 'add', 'origin', remoteUrl], { cwd: workspace });
  execFileSync('git', ['add', '.'], { cwd: workspace });
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: workspace, stdio: 'ignore' });
  execFileSync('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD'], { cwd: workspace });
  return workspace;
}

function runSync(env, { expectCode = 0 } = {}) {
  try {
    const out = execFileSync('/bin/sh', [SYNC_SCRIPT], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (expectCode !== 0) throw new Error(`expected exit ${expectCode}, got 0: ${out}`);
    return out;
  } catch (err) {
    if (expectCode === 0) throw err;
    const stderr = String(err.stderr || '');
    const stdout = String(err.stdout || '');
    return `${stdout}${stderr}`;
  }
}

function dedicatedHomeFixture(remoteUrl) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-visual-home-'));
  const workspace = path.join(parent, 'ARIInsightsVisualWorker');
  fs.mkdirSync(workspace, { recursive: true });
  const fixture = runtimeFixture({ remoteUrl });
  execFileSync('cp', ['-R', `${fixture}/.`, workspace], { stdio: 'ignore' });
  fs.rmSync(fixture, { recursive: true, force: true });
  return { parent, workspace };
}

test('sync refuses non-dedicated workspace path', () => {
  const workspace = runtimeFixture();
  const output = runSync({
    ARI_VISUAL_WORKER_WORKSPACE: workspace,
    HOME: os.tmpdir(),
    ARI_VISUAL_WORKER_VALIDATE_REMOTE_ONLY: '1',
  }, { expectCode: 1 });
  assert.match(output, /VISUAL_WORKER_WORKSPACE_IDENTITY_MISMATCH/);
  fs.rmSync(workspace, { recursive: true, force: true });
});

test('sync accepts CoaRetail HTTPS remote (identity only)', () => {
  const { parent } = dedicatedHomeFixture('https://github.com/CoaRetail/AI_readiness_index.git');
  const output = runSync({
    ARI_VISUAL_WORKER_WORKSPACE: path.join(parent, 'ARIInsightsVisualWorker'),
    HOME: parent,
    ARI_VISUAL_WORKER_VALIDATE_REMOTE_ONLY: '1',
  });
  assert.match(output, /VISUAL_WORKER_REMOTE_OK/);
  fs.rmSync(parent, { recursive: true, force: true });
});

test('sync accepts CME0358 SSH remote during migration (identity only)', () => {
  const { parent } = dedicatedHomeFixture('git@github.com:CME0358/AI_readiness_index.git');
  const output = runSync({
    ARI_VISUAL_WORKER_WORKSPACE: path.join(parent, 'ARIInsightsVisualWorker'),
    HOME: parent,
    ARI_VISUAL_WORKER_VALIDATE_REMOTE_ONLY: '1',
  });
  assert.match(output, /VISUAL_WORKER_REMOTE_OK/);
  fs.rmSync(parent, { recursive: true, force: true });
});

test('sync refuses unrelated github owner/repo', () => {
  const { parent } = dedicatedHomeFixture('https://github.com/other/example.git');
  const output = runSync({
    ARI_VISUAL_WORKER_WORKSPACE: path.join(parent, 'ARIInsightsVisualWorker'),
    HOME: parent,
    ARI_VISUAL_WORKER_VALIDATE_REMOTE_ONLY: '1',
  }, { expectCode: 1 });
  assert.match(output, /VISUAL_WORKER_WORKSPACE_IDENTITY_MISMATCH/);
  fs.rmSync(parent, { recursive: true, force: true });
});

test('sync refuses similar repo name suffix attack', () => {
  const { parent } = dedicatedHomeFixture('https://github.com/CoaRetail/AI_readiness_index-evil.git');
  const output = runSync({
    ARI_VISUAL_WORKER_WORKSPACE: path.join(parent, 'ARIInsightsVisualWorker'),
    HOME: parent,
    ARI_VISUAL_WORKER_VALIDATE_REMOTE_ONLY: '1',
  }, { expectCode: 1 });
  assert.match(output, /VISUAL_WORKER_WORKSPACE_IDENTITY_MISMATCH/);
  fs.rmSync(parent, { recursive: true, force: true });
});

test('sync refuses non-github host', () => {
  const { parent } = dedicatedHomeFixture('https://evilgithub.com/CoaRetail/AI_readiness_index.git');
  const output = runSync({
    ARI_VISUAL_WORKER_WORKSPACE: path.join(parent, 'ARIInsightsVisualWorker'),
    HOME: parent,
    ARI_VISUAL_WORKER_VALIDATE_REMOTE_ONLY: '1',
  }, { expectCode: 1 });
  assert.match(output, /VISUAL_WORKER_WORKSPACE_IDENTITY_MISMATCH/);
  fs.rmSync(parent, { recursive: true, force: true });
});

test('sync honors ARI_VISUAL_WORKER_EXPECTED_REPO legacy substring override', () => {
  const { parent } = dedicatedHomeFixture('https://github.com/custom-org/my-fork.git');
  const output = runSync({
    ARI_VISUAL_WORKER_WORKSPACE: path.join(parent, 'ARIInsightsVisualWorker'),
    HOME: parent,
    ARI_VISUAL_WORKER_EXPECTED_REPO: 'custom-org/my-fork',
    ARI_VISUAL_WORKER_VALIDATE_REMOTE_ONLY: '1',
  });
  assert.match(output, /VISUAL_WORKER_REMOTE_OK/);
  fs.rmSync(parent, { recursive: true, force: true });
});

test('full sync with fetch is not run in this suite (no network)', () => {
  assert.ok(true, 'identity validated via ARI_VISUAL_WORKER_VALIDATE_REMOTE_ONLY=1 only');
});
