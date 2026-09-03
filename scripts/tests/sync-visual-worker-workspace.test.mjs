import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SYNC_SCRIPT = path.join(ROOT, 'scripts/sync-visual-worker-workspace.sh');

function runtimeFixture({ remoteUrl = 'https://github.com/CME0358/AI_readiness_index.git', includeMarker = true } = {}) {
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

test('sync refuses non-dedicated workspace path', () => {
  const workspace = runtimeFixture();
  const output = runSync({
    ARI_VISUAL_WORKER_WORKSPACE: workspace,
    HOME: os.tmpdir(),
  }, { expectCode: 1 });
  assert.match(output, /VISUAL_WORKER_WORKSPACE_IDENTITY_MISMATCH/);
  fs.rmSync(workspace, { recursive: true, force: true });
});

test('sync refuses workspace when origin lacks runtime marker', () => {
  const workspace = runtimeFixture({ includeMarker: false });
  const output = runSync({
    ARI_VISUAL_WORKER_WORKSPACE: workspace,
    HOME: workspace,
  }, { expectCode: 1 });
  assert.match(output, /VISUAL_WORKER_WORKSPACE_IDENTITY_MISMATCH/);
  fs.rmSync(workspace, { recursive: true, force: true });
});

test('sync refuses unexpected remote origin', () => {
  const workspace = runtimeFixture({ remoteUrl: 'https://github.com/other/example.git' });
  const output = runSync({
    ARI_VISUAL_WORKER_WORKSPACE: workspace,
    HOME: workspace,
  }, { expectCode: 1 });
  assert.match(output, /VISUAL_WORKER_WORKSPACE_IDENTITY_MISMATCH/);
  fs.rmSync(workspace, { recursive: true, force: true });
});

test('sync logs origin/main SHA before and after reset on dedicated workspace', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-visual-home-'));
  const workspace = path.join(parent, 'ARIInsightsVisualWorker');
  fs.mkdirSync(workspace, { recursive: true });
  const fixture = runtimeFixture();
  execFileSync('cp', ['-R', `${fixture}/.`, workspace], { stdio: 'ignore' });
  fs.rmSync(fixture, { recursive: true, force: true });

  const output = runSync({
    ARI_VISUAL_WORKER_WORKSPACE: workspace,
    HOME: parent,
  });
  assert.match(output, /VISUAL_WORKER_SYNC_OK/);
  assert.match(output, /origin_main_sha=[0-9a-f]{40}/);
  assert.match(output, /head_before=[0-9a-f]{40}/);
  assert.match(output, /head_after=[0-9a-f]{40}/);
  fs.rmSync(parent, { recursive: true, force: true });
});
