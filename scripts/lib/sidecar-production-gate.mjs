/**
 * Hard gates for ARI X Traffic Sidecar live Buffer mutations.
 * Live create remains disabled until explicit multi-factor approval.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './insights-v2-paths.mjs';

export const SIDECAR_LIVE_CREATE_ENV = 'ARI_X_TRAFFIC_LIVE_CREATE';
export const SIDECAR_APPROVAL_RELATIVE = 'insights/_social/x-sidecar/.live-create-approved';

export function sidecarApprovalPath({ root = ROOT } = {}) {
  return path.join(root, SIDECAR_APPROVAL_RELATIVE);
}

export function readSidecarApproval({ root = ROOT } = {}) {
  const file = sidecarApprovalPath({ root });
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.approved === true && parsed?.expiresAt) return parsed;
  } catch {
    // legacy single-line token
    if (/^approved:[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(raw)) {
      return { approved: true, expiresAt: `${raw.slice(-10)}T23:59:59+09:00`, token: raw };
    }
  }
  return null;
}

export function evaluateSidecarProductionGate({
  env = process.env,
  now = new Date(),
  root = ROOT,
  argv = process.argv,
} = {}) {
  const enabled = env.ARI_X_TRAFFIC_ENABLED === 'true';
  const liveCreate = env[SIDECAR_LIVE_CREATE_ENV] === 'true';
  const dryRun = env.ARI_X_TRAFFIC_DRY_RUN !== 'false' || argv.includes('--dry-run');
  const approval = readSidecarApproval({ root });
  const approvalValid = Boolean(
    approval?.approved &&
    approval.expiresAt &&
    !Number.isNaN(new Date(approval.expiresAt).getTime()) &&
    new Date(approval.expiresAt).getTime() >= now.getTime(),
  );

  const reasons = [];
  if (!enabled) reasons.push('ARI_X_TRAFFIC_ENABLED is not true');
  if (dryRun) reasons.push('dry-run mode is active');
  if (!liveCreate) reasons.push(`${SIDECAR_LIVE_CREATE_ENV} is not true`);
  if (!approvalValid) reasons.push('missing or expired sidecar live-create approval file');

  const liveCreateAllowed = enabled && !dryRun && liveCreate && approvalValid;
  return {
    enabled,
    dryRun,
    liveCreate,
    approvalValid,
    liveCreateAllowed,
    reasons,
    approvalPath: sidecarApprovalPath({ root }),
  };
}

/** Throws when a caller attempts sidecar live Buffer mutations without approval. */
export function assertSidecarLiveCreateAllowed(opts = {}) {
  const gate = evaluateSidecarProductionGate(opts);
  if (gate.liveCreateAllowed) return gate;
  const detail = gate.reasons.join('; ');
  throw new Error(`SIDECAR_LIVE_CREATE_BLOCKED: ${detail}`);
}

/** Fail closed when sidecar is partially enabled outside dry-run. */
export function assertSidecarSafeMode(opts = {}) {
  const gate = evaluateSidecarProductionGate(opts);
  if (gate.dryRun) return gate;
  if (gate.enabled && !gate.liveCreateAllowed) {
    throw new Error(
      `SIDECAR_UNSAFE_CONFIGURATION: enabled without approved live-create gate (${gate.reasons.join('; ')})`,
    );
  }
  return gate;
}
