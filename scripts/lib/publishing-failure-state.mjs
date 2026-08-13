/**
 * Durable operational failure records (no secrets).
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './insights-v2-paths.mjs';

export const FAILURE_STATE_FILE = path.join(PATHS.reportsDir, 'publishing-pipeline-failures.json');

export function loadFailureState() {
  if (!fs.existsSync(FAILURE_STATE_FILE)) {
    return { version: 1, updatedAt: null, failures: {} };
  }
  return JSON.parse(fs.readFileSync(FAILURE_STATE_FILE, 'utf8'));
}

export function saveFailureState(state, { dryRun = false } = {}) {
  if (dryRun) return false;
  fs.mkdirSync(PATHS.reportsDir, { recursive: true });
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(FAILURE_STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
  return true;
}

/**
 * @param {{ slug: string, stage: string, failureReason: string, retryable?: boolean, attemptCount?: number, lastSuccessStage?: string|null }} entry
 */
export function recordPipelineFailure(entry, { dryRun = false } = {}) {
  const state = loadFailureState();
  const prev = state.failures[entry.slug] || {};
  state.failures[entry.slug] = {
    slug: entry.slug,
    stage: entry.stage,
    attemptedAt: new Date().toISOString(),
    failureReason: String(entry.failureReason || 'unknown').slice(0, 500),
    retryable: entry.retryable !== false,
    attemptCount: entry.attemptCount ?? (prev.attemptCount || 0) + 1,
    lastSuccessStage: entry.lastSuccessStage ?? prev.lastSuccessStage ?? null,
  };
  saveFailureState(state, { dryRun });
  return state.failures[entry.slug];
}

export function clearPipelineFailure(slug, { dryRun = false, lastSuccessStage = null } = {}) {
  const state = loadFailureState();
  if (state.failures[slug]) {
    delete state.failures[slug];
  }
  if (lastSuccessStage) {
    state.lastSuccess = { slug, stage: lastSuccessStage, at: new Date().toISOString() };
  }
  saveFailureState(state, { dryRun });
}

export function getPipelineFailure(slug) {
  return loadFailureState().failures[slug] || null;
}
