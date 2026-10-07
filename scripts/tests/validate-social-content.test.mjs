import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { socialCopyBlockersForEntry, validateSocialContentForSlug } from '../lib/validate-social-content.mjs';
import { CHANNEL_CONTENT_DIRS } from '../lib/social-channels.mjs';

function writeSocial(root, slug, channel, body) {
  const dir = path.join(root, CHANNEL_CONTENT_DIRS[channel]);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${slug}.md`), body, 'utf8');
}

test('validateSocialContentForSlug passes compliant copy', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-social-validate-'));
  const slug = 'sample-article';
  const url = `https://readiness.coaretail.com/insights/${slug}/`;
  writeSocial(root, slug, 'linkedin', `${'a'.repeat(450)} ${url} #AgentReadiness #AI`);
  writeSocial(root, slug, 'facebook', `${'b'.repeat(300)} ${url} #AI`);
  writeSocial(root, slug, 'x', `${'c'.repeat(80)} ${url} #AI`);
  const result = validateSocialContentForSlug(slug, { root, articleUrlOverride: url });
  assert.equal(result.ok, true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('validateSocialContentForSlug fails short linkedin copy', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-social-validate-'));
  const slug = 'short-copy';
  const url = `https://readiness.coaretail.com/insights/${slug}/`;
  writeSocial(root, slug, 'linkedin', `too short ${url} #AgentReadiness #AI`);
  writeSocial(root, slug, 'facebook', `${'b'.repeat(300)} ${url} #AI`);
  writeSocial(root, slug, 'x', `${'c'.repeat(80)} ${url} #AI`);
  const result = validateSocialContentForSlug(slug, { root, articleUrlOverride: url });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].channel, 'linkedin');
  fs.rmSync(root, { recursive: true, force: true });
});

test('socialCopyBlockersForEntry blocks scheduled copy outside Buffer length', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-social-validate-'));
  const slug = 'short-copy';
  const url = `https://readiness.coaretail.com/insights/${slug}/`;
  writeSocial(root, slug, 'linkedin', `too short ${url} #AgentReadiness #AI`);
  writeSocial(root, slug, 'facebook', `${'b'.repeat(300)} ${url} #AI`);
  writeSocial(root, slug, 'x', `${'c'.repeat(80)} ${url} #AI`);
  const blockers = socialCopyBlockersForEntry(slug, { status: 'scheduled' }, { root });
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].code, 'SOCIAL_COPY_LENGTH');
  assert.match(blockers[0].message, /linkedin: length \d+ outside 450-900/);
  assert.deepEqual(socialCopyBlockersForEntry(slug, { status: 'published' }, { root }), []);
  fs.rmSync(root, { recursive: true, force: true });
});
