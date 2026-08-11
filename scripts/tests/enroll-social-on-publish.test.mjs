#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  expectedSocialQueuePostCount,
  socialContentFilesExist,
} from '../lib/enroll-social-on-publish.mjs';
import { EDITORIAL_STATUSES } from '../lib/editorial-status.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('expectedSocialQueuePostCount adds current-event scheduled/published slots', () => {
  const schedule = {
    articles: [
      { slug: 'a', series: 'v2', status: EDITORIAL_STATUSES.HOLD },
      { slug: 'cf', series: 'current-event', status: EDITORIAL_STATUSES.PUBLISHED },
    ],
  };
  assert.equal(expectedSocialQueuePostCount(schedule), 31);
});

test('cloudflare-aeo social post files exist in repo', () => {
  assert.equal(socialContentFilesExist('cloudflare-aeo'), true);
});

test('socialContentFilesExist rejects missing slug', () => {
  assert.equal(socialContentFilesExist('missing-slug-xyz'), false);
});
