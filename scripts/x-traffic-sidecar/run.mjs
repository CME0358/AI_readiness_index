#!/usr/bin/env node
import fs from 'node:fs';
import { PATHS } from '../lib/insights-v2-paths.mjs';
import {
  DEFAULT_COOLDOWN_DAYS,
  DEFAULT_MAX_UTF16,
  evaluateCapacity,
  LEDGER_PATH,
  OWNERSHIP,
  REDIRECTS_PATH,
  ROOT,
  SLOTS,
  SIDECAR_VERSION,
  SITE_ORIGIN,
  loadPublishedInsights,
  planDay,
  readJson,
  ymdJst,
} from './core.mjs';
import { loadCanonicalBufferEnv } from '../lib/buffer-env.mjs';
import { getBufferConfig, getChannelId } from '../lib/buffer-client.mjs';
import { assertSidecarSafeMode } from '../lib/sidecar-production-gate.mjs';
import { deliverSidecarPlan, isPlanPostDeliverable, isSlotSchedulable } from '../lib/sidecar-buffer-delivery.mjs';

const dryRun = process.env.ARI_X_TRAFFIC_DRY_RUN !== 'false' || process.argv.includes('--dry-run');
const enabled = process.env.ARI_X_TRAFFIC_ENABLED === 'true';
const dateArg = process.argv.find((arg) => arg.startsWith('--date='))?.split('=')[1];
const date = dateArg || ymdJst();
const cooldownDays = Number(process.env.ARI_X_TRAFFIC_COOLDOWN_DAYS || DEFAULT_COOLDOWN_DAYS);
const maxUtf16 = Number(process.env.ARI_X_TRAFFIC_MAX_UTF16 || DEFAULT_MAX_UTF16);

function verifiedSlugs() {
  if (!fs.existsSync(PATHS.schedule)) return null;
  const schedule = JSON.parse(fs.readFileSync(PATHS.schedule, 'utf8'));
  return new Set(schedule.articles.filter((a) => a.status === 'published' && a.productionVerifiedAt).map((a) => a.slug));
}

function syncLedgerSentStates(ledger) {
  const next = { ...ledger, posts: [...(ledger?.posts || [])] };
  for (const entry of next.posts) {
    if (entry.buffer_post_id && entry.state === 'SCHEDULED' && entry.date < ymdJst()) {
      entry.state = 'SENT';
      entry.remote_state = 'SENT';
      entry.published_at = entry.published_at || entry.scheduled_at;
      entry.updated_at = new Date().toISOString();
    }
  }
  return next;
}

function safeCapacityUnknown(reason) {
  return { status: 'CAPACITY_UNKNOWN', safe: false, reason };
}

async function bufferReadOnlyGate({ date, cfg, requestedCount = SLOTS.length }) {
  const channelId = getChannelId('x', cfg);
  if (!cfg.accessToken || !cfg.organizationId || !channelId) return safeCapacityUnknown('missing_buffer_read_only_configuration');
  const query = `query SidecarCapacity($organizationId: OrganizationId!, $organizationFilterId: String!, $channelId: ChannelId!, $date: DateTime!) {
    account { organizations(filter: { organizationId: $organizationFilterId }) { id limits { scheduledPosts } } }
    posts(first: 100, input: { organizationId: $organizationId, filter: { status: [scheduled] } }) {
      edges { node { id channelId status dueAt text assets { source } } }
      pageInfo { hasNextPage }
    }
    dailyPostingLimits(input: { channelIds: [$channelId], date: $date }) {
      channelId isAtLimit limit scheduled sent
    }
  }`;
  try {
    const response = await fetch('https://api.buffer.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.accessToken}` },
      body: JSON.stringify({ query, variables: { organizationId: cfg.organizationId, organizationFilterId: cfg.organizationId, channelId, date: `${date}T00:00:00+09:00` } }),
    });
    const data = await response.json();
    if (!response.ok || data.errors?.length || !data.data?.dailyPostingLimits?.length) return safeCapacityUnknown('buffer_capacity_query_failed');
    const scheduled = data.data.posts?.edges?.map((edge) => edge.node).filter(Boolean) || [];
    const limit = data.data.dailyPostingLimits[0];
    const organizationLimit = data.data.account?.organizations?.[0]?.limits?.scheduledPosts;
    if (data.data.posts?.pageInfo?.hasNextPage || organizationLimit == null) return safeCapacityUnknown('scheduled_posts_or_organization_limit_unknown');
    const requested = requestedCount;
    const capacity = evaluateCapacity({
      scheduledCount: scheduled.length,
      requestedCount: requested,
      organizationLimit,
      dailyLimit: limit,
    });
    return {
      status: capacity.status,
      safe: capacity.safe,
      scheduledCount: scheduled.length,
      scheduledPosts: scheduled,
      dailyLimit: limit,
      organizationScheduledLimit: organizationLimit,
      rateLimitHeaders: {
        remaining: response.headers.get('ratelimit'),
        policy: response.headers.get('ratelimit-policy'),
        retryAfter: response.headers.get('retry-after'),
      },
    };
  } catch (error) {
    return safeCapacityUnknown(String(error.message || error));
  }
}

function printPlan(plan, capacity, gate, delivery = null) {
  console.log('=== ARI X TRAFFIC SIDECAR DAILY REPORT ===');
  console.log(`DATE: ${plan.date}`);
  console.log(`TIMEZONE: ${plan.timezone}`);
  console.log(`SIDECAR_VERSION: ${SIDECAR_VERSION}`);
  console.log(`CANDIDATES_FOUND: ${plan.selection.eligibleCount}`);
  console.log(`SELECTED: ${plan.selection.chosen.length}`);
  console.log(`BUFFER_CAPACITY_GATE: ${capacity.status}`);
  for (const post of plan.posts) {
    console.log(`\n${post.slot}:`);
    console.log(`ARTICLE: ${post.article_slug || '—'}`);
    console.log(`ANGLE: ${post.content_angle || '—'}`);
    console.log(`FULL X POST TEXT:\n${post.generated_text || '—'}`);
    console.log(`SHORT_URL: ${post.short_url || '—'}`);
    console.log(`DESTINATION: ${post.destination_url || '—'}`);
    console.log(`HERO: ${post.hero_url || '—'}`);
    console.log(`VALIDATION: ${post.validation ? JSON.stringify(post.validation) : post.error_code}`);
    console.log(`STATUS: ${post.state}`);
  }
  console.log(`\nTOTAL_SCHEDULED: ${capacity.safe && !dryRun ? plan.posts.filter((p) => p.state === 'SCHEDULED').length : 0}`);
  console.log(`TOTAL_HOLD: ${plan.posts.filter((p) => p.state === 'HOLD').length + (capacity.safe ? 0 : plan.posts.filter((p) => p.state !== 'HOLD').length)}`);
  console.log('EXISTING_BUFFER_POSTS_MODIFIED: 0');
  console.log('EXISTING_BUFFER_POSTS_DELETED: 0');
  console.log(`PRODUCTION_ACTIVATION: ${gate.liveCreateAllowed ? (delivery ? 'LIVE' : 'APPROVED') : 'HOLD'}`);
  if (!gate.liveCreateAllowed) {
    console.log(`SIDECAR_GATE: ${gate.reasons.join('; ')}`);
  }
  if (delivery?.results?.length) {
    console.log('\nDELIVERY:');
    for (const item of delivery.results) {
      console.log(JSON.stringify(item));
    }
  }
}

async function main() {
  const now = new Date();
  const gate = assertSidecarSafeMode({ argv: process.argv });
  let ledger = syncLedgerSentStates(readJson(LEDGER_PATH, { posts: [] }));
  const articles = loadPublishedInsights({ root: ROOT });
  const redirects = readJson(REDIRECTS_PATH, { redirects: [] });
  const plan = planDay({ date, articles, ledger, redirects, cooldownDays, verifiedSlugs: verifiedSlugs(), maxUtf16 });
  loadCanonicalBufferEnv();
  const cfg = getBufferConfig();
  const pendingCount = plan.posts.filter((post) => isPlanPostDeliverable(post) && isSlotSchedulable(post.scheduled_at, now)).length;
  const capacity = await bufferReadOnlyGate({ date, cfg, requestedCount: pendingCount || 1 });
  if (!dryRun && (!enabled || !capacity.safe)) {
    for (const post of plan.posts) if (post.state !== 'HOLD') post.state = 'HOLD';
  }
  let delivery = null;
  if (!dryRun && enabled && capacity.safe) {
    delivery = await deliverSidecarPlan({
      plan,
      ledger,
      redirects,
      cfg,
      now,
      dryRun: false,
    });
    if (delivery.exitCode !== 0) process.exitCode = delivery.exitCode;
  }
  printPlan(plan, capacity, gate, delivery);
}

main().catch((error) => {
  console.error(`SIDECAR_ERROR: ${error.message}`);
  process.exitCode = 1;
});
