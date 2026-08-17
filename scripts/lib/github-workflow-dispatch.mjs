/**
 * Trigger the GitHub Actions reconciler from Vercel Cron.
 */
import { isWeekday } from './business-days.mjs';

export const DEFAULT_REPO = 'CME0358/AI_readiness_index';
export const PUBLISH_WORKFLOW_FILE = 'reconcile-publishing-pipeline.yml';

export function parseGitHubRepo(repo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO) {
  const [owner, name] = String(repo || '').split('/');
  if (!owner || !name) throw new Error(`Invalid GITHUB_REPOSITORY: ${repo}`);
  return { owner, name };
}

/** Nominal Web publish instant for the current JST business day. */
export function buildPublishNowIso(date = new Date()) {
  const ymd = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
  return `${ymd}T10:00:00+09:00`;
}

export function verifyCronAuth(req, cronSecret = process.env.CRON_SECRET) {
  if (!cronSecret) return { ok: false, reason: 'CRON_SECRET not configured' };
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  if (auth === `Bearer ${cronSecret}`) return { ok: true };
  return { ok: false, reason: 'Unauthorized' };
}

export async function dispatchGitHubWorkflow({
  workflowFile,
  ref = 'main',
  inputs = {},
  token,
  repo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO,
  fetchImpl = fetch,
} = {}) {
  if (!workflowFile) throw new Error('workflowFile is required');
  if (!token) throw new Error('GITHUB_DISPATCH_TOKEN is required');

  const { owner, name } = parseGitHubRepo(repo);
  const url = `https://api.github.com/repos/${owner}/${name}/actions/workflows/${workflowFile}/dispatches`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref, inputs }),
  });

  if (res.status === 204) {
    return { ok: true, status: 204 };
  }

  const body = await res.json().catch(() => ({}));
  return {
    ok: false,
    status: res.status,
    error: body.message || body.errors?.[0]?.message || `HTTP ${res.status}`,
  };
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {{ CRON_SECRET?: string, GITHUB_DISPATCH_TOKEN?: string, GITHUB_REPOSITORY?: string, now?: Date }} [env]
 */
export async function handlePublishInsightsCron(req, env = process.env) {
  const auth = verifyCronAuth(req, env.CRON_SECRET);
  if (!auth.ok) {
    const status = auth.reason === 'CRON_SECRET not configured' ? 503 : 401;
    return { status, body: { error: auth.reason } };
  }

  const now = env.now instanceof Date ? env.now : new Date();
  if (!isWeekday(now)) {
    return { status: 200, body: { skipped: true, reason: 'weekend' } };
  }

  const token = env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return { status: 503, body: { error: 'GITHUB_DISPATCH_TOKEN not configured' } };
  }

  const publishNow = buildPublishNowIso(now);
  const result = await dispatchGitHubWorkflow({
    workflowFile: PUBLISH_WORKFLOW_FILE,
    token,
    repo: env.GITHUB_REPOSITORY || DEFAULT_REPO,
    inputs: { now: publishNow },
    fetchImpl: env.fetchImpl || fetch,
  });

  if (!result.ok) {
    return {
      status: 502,
      body: {
        error: result.error,
        githubStatus: result.status,
        workflow: PUBLISH_WORKFLOW_FILE,
      },
    };
  }

  return {
    status: 200,
    body: {
      dispatched: true,
      workflow: PUBLISH_WORKFLOW_FILE,
      now: publishNow,
      trigger: 'vercel-cron',
    },
  };
}
