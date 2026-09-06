import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  PREPUBLISH_ROLES,
  isNativeHeroEnvironment,
  resolvePrepublishRole,
  triggerImmediatePrepublishHero,
} from '../lib/trigger-immediate-prepublish-hero.mjs';
import { applyEmergencyEditorialInsert } from '../lib/apply-emergency-editorial-insert.mjs';
import { EDITORIAL_STATUSES } from '../lib/editorial-status.mjs';

test('resolvePrepublishRole maps launchd roles', () => {
  assert.equal(resolvePrepublishRole('PRIMARY_IMMEDIATE'), PREPUBLISH_ROLES.PRIMARY_IMMEDIATE);
  assert.equal(resolvePrepublishRole('RETRY_PREPUBLISH'), PREPUBLISH_ROLES.RETRY_PREPUBLISH);
  assert.equal(resolvePrepublishRole('MORNING_PREFLIGHT'), PREPUBLISH_ROLES.MORNING_PREFLIGHT);
  assert.equal(resolvePrepublishRole(undefined), PREPUBLISH_ROLES.RETRY_PREPUBLISH);
});

test('triggerImmediatePrepublishHero defers in CI', () => {
  const prev = process.env.CI;
  process.env.CI = 'true';
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-hero-trigger-'));
  const result = triggerImmediatePrepublishHero({ root });
  assert.equal(result.triggered, false);
  assert.equal(result.reason, 'NOT_NATIVE_ENVIRONMENT');
  process.env.CI = prev;
  fs.rmSync(root, { recursive: true, force: true });
});

test('emergency insert dry-run cascades displaced article', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-esb-apply-'));
  fs.mkdirSync(path.join(root, 'insights/_scheduled/exec-readiness-kpi'), { recursive: true });
  fs.mkdirSync(path.join(root, 'insights/_scheduled/ai-search-52-percent'), { recursive: true });
  fs.writeFileSync(path.join(root, 'insights/_scheduled/exec-readiness-kpi/index.html'), '<article></article>');
  fs.writeFileSync(path.join(root, 'insights/_scheduled/ai-search-52-percent/index.html'), '<article></article>');
  fs.writeFileSync(path.join(root, 'insights/_scheduled/schedule.json'), JSON.stringify({
    articles: [{
      slug: 'exec-readiness-kpi',
      status: EDITORIAL_STATUSES.SCHEDULED,
      publishAt: '2026-09-07T10:00:00+09:00',
      title: 'KPI',
    }],
  }));
  fs.mkdirSync(path.join(root, 'insights/_social/linkedin'), { recursive: true });
  fs.mkdirSync(path.join(root, 'insights/_social/buffer'), { recursive: true });
  fs.writeFileSync(path.join(root, 'insights/_social/linkedin/queue.json'), JSON.stringify({ posts: [] }));
  fs.writeFileSync(path.join(root, 'insights/_social/buffer/queue.json'), JSON.stringify({ posts: [] }));
  fs.writeFileSync(path.join(root, 'insights/index.html'), '<!-- INSIGHTS_CARDS_START -->');

  const result = applyEmergencyEditorialInsert({
    root,
    slug: 'ai-search-52-percent',
    targetDate: '2026-09-07',
    scheduleMetadata: { title: 'Breaking', series: 'current-event' },
    dryRun: true,
    triggerHero: false,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.plan.displaced, [{ slug: 'exec-readiness-kpi', from: '2026-09-07', to: '2026-09-08' }]);
  fs.rmSync(root, { recursive: true, force: true });
});

test('isNativeHeroEnvironment is false under GITHUB_ACTIONS', () => {
  const prev = process.env.GITHUB_ACTIONS;
  process.env.GITHUB_ACTIONS = 'true';
  assert.equal(isNativeHeroEnvironment(), false);
  process.env.GITHUB_ACTIONS = prev;
});
