/**
 * Trigger PRIMARY_PREPUBLISH hero generation immediately after article scheduling.
 * Non-blocking: failures do not affect article/schedule state.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PATHS } from './insights-v2-paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '../..');

export const PREPUBLISH_ROLES = Object.freeze({
  PRIMARY_IMMEDIATE: 'PRIMARY_IMMEDIATE',
  RETRY_PREPUBLISH: 'RETRY_PREPUBLISH',
  MORNING_PREFLIGHT: 'MORNING_PREFLIGHT',
});

/** True when Codex Native hero generation can run on this host. */
export function isNativeHeroEnvironment() {
  if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') return false;
  if (process.env.ARI_SKIP_NATIVE_HERO === '1') return false;
  const which = spawnSync('which', ['codex'], { encoding: 'utf8' });
  return which.status === 0 && Boolean(which.stdout?.trim());
}

function writeHeroRequestMarker(root, payload) {
  const reportPath = path.join(root, 'reports/prepublish-hero-request.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return reportPath;
}

/**
 * Spawn detached prepublish hero worker after schedule persistence.
 * @param {{ root?: string, role?: string, slug?: string|null, now?: Date, spawnFn?: typeof spawn }} [options]
 */
export function triggerImmediatePrepublishHero({
  root = DEFAULT_ROOT,
  role = PREPUBLISH_ROLES.PRIMARY_IMMEDIATE,
  slug = null,
  now = new Date(),
  spawnFn = spawn,
} = {}) {
  const payload = {
    requestedAt: now.toISOString(),
    role,
    slug,
    nativeCapable: isNativeHeroEnvironment(),
  };

  if (!isNativeHeroEnvironment()) {
    const marker = writeHeroRequestMarker(root, { ...payload, status: 'DEFERRED_TO_LOCAL_RUNTIME' });
    return { triggered: false, reason: 'NOT_NATIVE_ENVIRONMENT', marker, role };
  }

  const script = path.join(root, 'scripts/run-prepublish-hero.sh');
  if (!fs.existsSync(script)) {
    return { triggered: false, reason: 'SCRIPT_MISSING', role };
  }

  const child = spawnFn('/bin/sh', [script], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      ARI_PREPUBLISH_ROLE: role,
    },
  });
  child.unref();

  const marker = writeHeroRequestMarker(root, { ...payload, status: 'TRIGGERED', pid: child.pid });
  return { triggered: true, pid: child.pid, role, marker };
}

/**
 * Resolve launchd/cron role semantics for scheduled prepublish runs.
 * @param {string} [roleEnv]
 */
export function resolvePrepublishRole(roleEnv = process.env.ARI_PREPUBLISH_ROLE) {
  if (roleEnv === PREPUBLISH_ROLES.MORNING_PREFLIGHT) return PREPUBLISH_ROLES.MORNING_PREFLIGHT;
  if (roleEnv === PREPUBLISH_ROLES.RETRY_PREPUBLISH) return PREPUBLISH_ROLES.RETRY_PREPUBLISH;
  if (roleEnv === PREPUBLISH_ROLES.PRIMARY_IMMEDIATE) return PREPUBLISH_ROLES.PRIMARY_IMMEDIATE;
  return PREPUBLISH_ROLES.RETRY_PREPUBLISH;
}
