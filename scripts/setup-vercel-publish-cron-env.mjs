#!/usr/bin/env node
/**
 * One-shot provisioner for Vercel Cron env vars (10:00 JST publish trigger).
 *
 * Usage:
 *   VERCEL_TOKEN=... node scripts/setup-vercel-publish-cron-env.mjs
 *   VERCEL_TOKEN=... GITHUB_DISPATCH_TOKEN=... CRON_SECRET=... node scripts/setup-vercel-publish-cron-env.mjs
 *
 * Optional:
 *   VERCEL_PROJECT=ai-readiness-index
 *   VERCEL_TEAM_ID=team_bca3GA1UtAZfnPhpeoaqH6Vs
 */
import crypto from 'node:crypto';

const PROJECT = process.env.VERCEL_PROJECT || 'ai-readiness-index';
const TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_bca3GA1UtAZfnPhpeoaqH6Vs';
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET || crypto.randomBytes(32).toString('hex');
const GITHUB_DISPATCH_TOKEN = process.env.GITHUB_DISPATCH_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || 'CME0358/AI_readiness_index';

if (!VERCEL_TOKEN) {
  console.error('VERCEL_TOKEN is required.');
  console.error('Create at: https://vercel.com/account/tokens');
  process.exit(1);
}

if (!GITHUB_DISPATCH_TOKEN) {
  console.error('GITHUB_DISPATCH_TOKEN is required (fine-grained PAT: repo + Actions write).');
  process.exit(1);
}

async function upsertEnv(key, value, type = 'sensitive') {
  const url = new URL(`https://api.vercel.com/v10/projects/${PROJECT}/env`);
  url.searchParams.set('upsert', 'true');
  url.searchParams.set('teamId', TEAM_ID);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key,
      value,
      type,
      target: ['production'],
      comment: 'Strict 10:00 JST Insights publish cron',
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${key}: HTTP ${res.status} ${body.error?.message || JSON.stringify(body)}`);
  }
  return body;
}

async function triggerRedeploy() {
  const url = new URL(`https://api.vercel.com/v13/deployments`);
  url.searchParams.set('teamId', TEAM_ID);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: PROJECT,
      target: 'production',
      gitSource: {
        type: 'github',
        repo: GITHUB_REPOSITORY.split('/')[1],
        org: GITHUB_REPOSITORY.split('/')[0],
        ref: 'main',
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn('Redeploy request failed (env still saved):', body.error?.message || res.status);
    return null;
  }
  return body.url || body.id;
}

async function main() {
  console.log('Upserting Vercel env vars for project:', PROJECT);
  for (const [key, value] of [
    ['CRON_SECRET', CRON_SECRET],
    ['GITHUB_DISPATCH_TOKEN', GITHUB_DISPATCH_TOKEN],
    ['GITHUB_REPOSITORY', GITHUB_REPOSITORY],
  ]) {
    await upsertEnv(key, value);
    console.log('  OK', key);
  }

  console.log('\nCRON_SECRET (save for manual curl tests):');
  console.log(CRON_SECRET);

  const redeploy = await triggerRedeploy();
  if (redeploy) console.log('\nRedeploy triggered:', redeploy);
  else console.log('\nRedeploy manually from Vercel dashboard to apply env vars.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
