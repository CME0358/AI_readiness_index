/**
 * Live Buffer delivery for ARI X Traffic Sidecar planned posts.
 */
import fs from 'node:fs';
import { OWNERSHIP, REDIRECTS_PATH, LEDGER_PATH, SIDECAR_VERSION } from '../x-traffic-sidecar/core.mjs';
import { assertSidecarLiveCreateAllowed } from './sidecar-production-gate.mjs';
import { createBufferPost, getChannelId } from './buffer-client.mjs';
import { isScheduleInstantInFuture } from './social-schedule.mjs';

export function findLedgerEntry(ledger, sidecarPostId) {
  return (ledger?.posts || []).find((entry) => entry.sidecar_post_id === sidecarPostId) || null;
}

export function isPlanPostDeliverable(post) {
  if (!post || post.state === 'HOLD') return false;
  if (!post.generated_text || !post.scheduled_at || !post.hero_url) return false;
  const validation = post.validation || {};
  const required = ['article', 'canonical', 'hero', 'short_url_unique', 'redirect_target_valid', 'x_length_valid'];
  return required.every((key) => validation[key] === true);
}

export function isSlotSchedulable(scheduledAt, now = new Date()) {
  if (!scheduledAt) return false;
  return new Date(scheduledAt).getTime() > now.getTime();
}

export function buildLedgerRecord(planPost, { bufferPostId, now = new Date(), remoteState = 'SCHEDULED' } = {}) {
  const iso = now.toISOString();
  return {
    sidecar_post_id: planPost.sidecar_post_id,
    sidecar_version: SIDECAR_VERSION,
    date: planPost.date,
    slot: planPost.slot,
    article_slug: planPost.article_slug,
    article_title: planPost.article_title,
    article_url: planPost.article_url,
    content_angle: planPost.content_angle,
    generated_text: planPost.generated_text,
    short_id: planPost.short_id,
    short_url: planPost.short_url,
    destination_url: planPost.destination_url,
    utm_source: 'x',
    utm_medium: 'organic',
    utm_campaign: 'ari_x_traffic',
    utm_content: planPost.destination_url?.match(/utm_content=([^&]+)/)?.[1] || null,
    hero_url: planPost.hero_url,
    scheduled_at: planPost.scheduled_at,
    published_at: null,
    buffer_post_id: bufferPostId,
    x_post_id: null,
    x_post_url: null,
    state: remoteState,
    remote_state: remoteState,
    ownership: OWNERSHIP,
    error_code: null,
    error_message: null,
    created_at: iso,
    updated_at: iso,
  };
}

export function buildRedirectRecord(planPost) {
  return {
    short_id: planPost.short_id,
    destination: planPost.destination_url,
    article_slug: planPost.article_slug,
    date: planPost.date,
    slot: planPost.slot,
    ownership: OWNERSHIP,
  };
}

export function upsertRedirect(redirects, planPost) {
  const next = { ...redirects, redirects: [...(redirects?.redirects || [])] };
  const record = buildRedirectRecord(planPost);
  const index = next.redirects.findIndex((item) => item.short_id === record.short_id);
  if (index >= 0) next.redirects[index] = record;
  else next.redirects.push(record);
  return next;
}

export function upsertLedgerEntry(ledger, record) {
  const next = { ...ledger, posts: [...(ledger?.posts || [])] };
  const index = next.posts.findIndex((item) => item.sidecar_post_id === record.sidecar_post_id);
  if (index >= 0) {
    next.posts[index] = { ...next.posts[index], ...record, updated_at: record.updated_at };
  } else {
    next.posts.push(record);
  }
  return next;
}

export function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/**
 * @returns {Promise<{updated: boolean, results: object[], exitCode: number}>}
 */
export async function deliverSidecarPlan({
  plan,
  ledger,
  redirects,
  cfg,
  now = new Date(),
  dryRun = false,
  createPost = createBufferPost,
  assertLive = assertSidecarLiveCreateAllowed,
  paths = { ledger: LEDGER_PATH, redirects: REDIRECTS_PATH },
} = {}) {
  if (!dryRun) assertLive({ now, argv: process.argv });

  const channelId = getChannelId('x', cfg);
  if (!cfg?.accessToken || !cfg?.organizationId || !channelId) {
    throw new Error('missing Buffer configuration for sidecar delivery');
  }

  let nextLedger = { ...ledger, posts: [...(ledger?.posts || [])] };
  let nextRedirects = { ...redirects, redirects: [...(redirects?.redirects || [])] };
  const results = [];
  let updated = false;
  let anyFailed = false;

  for (const post of plan.posts || []) {
    if (!isPlanPostDeliverable(post)) {
      results.push({ slot: post.slot, action: 'skip', reason: post.error_code || 'not_deliverable' });
      continue;
    }

    const existing = findLedgerEntry(nextLedger, post.sidecar_post_id);
    if (existing?.buffer_post_id) {
      results.push({
        slot: post.slot,
        action: 'skip',
        reason: 'already_ledgered',
        bufferPostId: existing.buffer_post_id,
      });
      continue;
    }

    if (!isSlotSchedulable(post.scheduled_at, now)) {
      results.push({ slot: post.slot, action: 'skip', reason: 'past_slot' });
      continue;
    }

    if (!isScheduleInstantInFuture(post.scheduled_at)) {
      results.push({ slot: post.slot, action: 'skip', reason: 'due_at_not_future' });
      continue;
    }

    if (dryRun) {
      nextRedirects = upsertRedirect(nextRedirects, post);
      updated = true;
      results.push({
        slot: post.slot,
        action: 'dry_run',
        publishAt: post.scheduled_at,
        shortId: post.short_id,
      });
      continue;
    }

    const createResult = await createPost({
      channelKey: 'x',
      channelId,
      accessToken: cfg.accessToken,
      text: post.generated_text,
      dueAt: post.scheduled_at,
      mediaUrl: post.hero_url,
      dryRun: false,
    });

    if (createResult.error || !createResult.postId) {
      anyFailed = true;
      results.push({
        slot: post.slot,
        action: 'failed',
        error: createResult.error || 'missing_post_id',
      });
      continue;
    }

    nextRedirects = upsertRedirect(nextRedirects, post);
    updated = true;

    const record = buildLedgerRecord(post, {
      bufferPostId: createResult.postId,
      now,
      remoteState: 'SCHEDULED',
    });
    nextLedger = upsertLedgerEntry(nextLedger, record);
    updated = true;
    results.push({
      slot: post.slot,
      action: 'queued',
      bufferPostId: createResult.postId,
      publishAt: post.scheduled_at,
      dueAtUtc: createResult.dueAtUtc,
      shortId: post.short_id,
    });
  }

  if (updated && !dryRun) {
    writeJson(paths.ledger, nextLedger);
    writeJson(paths.redirects, nextRedirects);
  }

  return {
    updated,
    ledger: nextLedger,
    redirects: nextRedirects,
    results,
    exitCode: anyFailed ? 1 : 0,
  };
}
