import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BUFFER_ENV_KEYS, loadCanonicalBufferEnv } from '../lib/buffer-env.mjs';

test('canonical Buffer env loader reports presence without exposing values', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-buffer-env-'));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, 'BUFFER_ACCESS_TOKEN=token\nBUFFER_CHANNEL_ID_LINKEDIN=li\nBUFFER_CHANNEL_ID_FACEBOOK=fb\nBUFFER_CHANNEL_ID_TWITTER=x\nNOT_BUFFER=ignored\n');
  const env = {};
  const result = loadCanonicalBufferEnv({ env, file });
  assert.equal(result.loaded, true);
  assert.deepEqual(result.present.sort(), ['BUFFER_ACCESS_TOKEN', 'BUFFER_CHANNEL_ID_FACEBOOK', 'BUFFER_CHANNEL_ID_LINKEDIN', 'BUFFER_CHANNEL_ID_TWITTER']);
  assert.deepEqual(BUFFER_ENV_KEYS.includes('BUFFER_ACCESS_TOKEN'), true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('existing process environment wins over file values', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ari-buffer-env-'));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, 'BUFFER_CHANNEL_ID_LINKEDIN=file-value\n');
  const env = { BUFFER_CHANNEL_ID_LINKEDIN: 'process-value' };
  loadCanonicalBufferEnv({ env, file });
  assert.equal(env.BUFFER_CHANNEL_ID_LINKEDIN, 'process-value');
  fs.rmSync(dir, { recursive: true, force: true });
});
