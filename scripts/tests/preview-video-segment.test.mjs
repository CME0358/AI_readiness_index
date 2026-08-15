#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyVideoSegment, normalizeVideoSegment } from '../lib/video-segment.mjs';
import {
  PREVIEW_VIDEO_SEGMENT_TO_SCENE_ID,
  REPORT_SCENE_VIDEOS,
  normalizePreviewVideoSegment,
  resolvePreviewVideo,
} from '../../report/src/video-carousel-data.js';

const SCENE_SRC = Object.fromEntries(REPORT_SCENE_VIDEOS.map((v) => [v.id, v.src]));

test('classifyVideoSegment — segments + default membership', () => {
  assert.equal(classifyVideoSegment('歯科医院'), 'dental');
  assert.equal(classifyVideoSegment('美容皮膚科'), 'clinic');
  assert.equal(classifyVideoSegment('税理士事務所'), 'tax');
  assert.equal(classifyVideoSegment('不動産仲介'), 'estate');
  assert.equal(classifyVideoSegment('フィットネスジム'), 'membership');
  assert.equal(classifyVideoSegment('防水工事'), 'membership');
  assert.equal(classifyVideoSegment(''), 'membership');
});

test('normalizeVideoSegment — legacy generic merges to membership', () => {
  assert.equal(normalizeVideoSegment('generic'), 'membership');
  assert.equal(normalizeVideoSegment('estate'), 'estate');
  assert.equal(normalizeVideoSegment(''), 'membership');
});

test('resolvePreviewVideo — matrix matches industry video content', () => {
  assert.match(resolvePreviewVideo('membership').src, /scene-01-ai-search\.mp4$/);
  assert.match(resolvePreviewVideo('estate').src, /scene-02-compare\.mov$/);
  assert.match(resolvePreviewVideo('tax').src, /scene-03-recommend\.mov$/);
  assert.match(resolvePreviewVideo('dental').src, /scene-04-booking\.mov$/);
  assert.match(resolvePreviewVideo('clinic').src, /scene-05-action\.mov$/);
});

test('resolvePreviewVideo — legacy generic uses membership video', () => {
  assert.equal(resolvePreviewVideo('generic').src, SCENE_SRC['01']);
  assert.equal(normalizePreviewVideoSegment('generic'), 'membership');
});

test('resolvePreviewVideo — unknown segment falls back to membership', () => {
  assert.equal(resolvePreviewVideo('unknown').src, SCENE_SRC[PREVIEW_VIDEO_SEGMENT_TO_SCENE_ID.membership]);
  assert.equal(resolvePreviewVideo(null).src, SCENE_SRC['01']);
});

test('REPORT_SCENE_VIDEOS carousel sources unchanged', () => {
  assert.equal(REPORT_SCENE_VIDEOS.length, 5);
  assert.ok(REPORT_SCENE_VIDEOS.every((v) => v.src.includes('/report/scene-videos/')));
});
