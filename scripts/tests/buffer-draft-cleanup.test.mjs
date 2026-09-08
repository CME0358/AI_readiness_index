import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  classifyRemovableDraft,
  isCanonicalSlotTime,
  loadProtectedPostIds,
} from '../lib/buffer-draft-cleanup.mjs';
import {
  assertSidecarLiveCreateAllowed,
  assertSidecarSafeMode,
  evaluateSidecarProductionGate,
  sidecarApprovalPath,
} from '../lib/sidecar-production-gate.mjs';

test('isCanonicalSlotTime matches Insights canonical slots', () => {
  assert.equal(isCanonicalSlotTime('linkedin', '2026-09-08T11:30:00+09:00'), true);
  assert.equal(isCanonicalSlotTime('facebook', '2026-09-08T11:45:00+09:00'), true);
  assert.equal(isCanonicalSlotTime('x', '2026-09-08T12:00:00+09:00'), true);
  assert.equal(isCanonicalSlotTime('x', '2026-09-08T14:20:00+09:00'), false);
});

test('classifyRemovableDraft flags empty future draft', () => {
  const verdict = classifyRemovableDraft({
    id: 'draft-1',
    status: 'draft',
    text: '',
    dueAt: '2026-09-10T04:26:00.000Z',
  }, 'linkedin');
  assert.equal(verdict.remove, true);
  assert.equal(verdict.reason, 'draft_empty_or_placeholder');
});

test('classifyRemovableDraft keeps protected canonical scheduled post', () => {
  const verdict = classifyRemovableDraft({
    id: 'keep-1',
    status: 'scheduled',
    text: 'hello https://readiness.coaretail.com/insights/exec-readiness-kpi/ #AgentReadiness',
    dueAt: '2026-09-08T02:30:00.000Z',
  }, 'linkedin', { protectedIds: new Set(['keep-1']) });
  assert.equal(verdict.remove, false);
  assert.equal(verdict.reason, 'protected_ledger_id');
});

test('sidecar safe mode blocks enabled non-dry-run without approval', () => {
  assert.throws(
    () => assertSidecarSafeMode({
      env: {
        ARI_X_TRAFFIC_ENABLED: 'true',
        ARI_X_TRAFFIC_DRY_RUN: 'false',
        ARI_X_TRAFFIC_LIVE_CREATE: 'false',
      },
      argv: [],
      root: fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-gate-')),
    }),
    /SIDECAR_UNSAFE_CONFIGURATION/,
  );
});

test('sidecar live create requires approval file and env flag', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecar-gate-'));
  const approvalFile = sidecarApprovalPath({ root });
  fs.mkdirSync(path.dirname(approvalFile), { recursive: true });
  fs.writeFileSync(approvalFile, JSON.stringify({
    approved: true,
    expiresAt: '2099-12-31T23:59:59+09:00',
    approver: 'test',
  }), 'utf8');

  const gate = evaluateSidecarProductionGate({
    env: {
      ARI_X_TRAFFIC_ENABLED: 'true',
      ARI_X_TRAFFIC_DRY_RUN: 'false',
      ARI_X_TRAFFIC_LIVE_CREATE: 'true',
    },
    argv: [],
    root,
    now: new Date('2026-09-08T02:00:00.000Z'),
  });
  assert.equal(gate.liveCreateAllowed, true);
  assertSidecarLiveCreateAllowed({ env: gate.enabled ? {
    ARI_X_TRAFFIC_ENABLED: 'true',
    ARI_X_TRAFFIC_DRY_RUN: 'false',
    ARI_X_TRAFFIC_LIVE_CREATE: 'true',
  } : {}, argv: [], root, now: new Date('2026-09-08T02:00:00.000Z') });
});

test('loadProtectedPostIds includes buffer queue and sidecar ledger ids', () => {
  const ids = loadProtectedPostIds();
  assert.ok(ids.size >= 1);
});
