/**
 * Poll production until an Insights article URL returns HTTP 200.
 * Shared by Buffer transfer and post-deploy IndexNow.
 */
import { verifyArticleUrl } from './url-verify.mjs';

export const PRODUCTION_DEPLOY_WAIT_MS = 90_000;
export const PRODUCTION_DEPLOY_POLL_MS = 10_000;

/**
 * @param {string} slug
 * @param {{ verifyFn?: typeof verifyArticleUrl, deadlineMs?: number, pollMs?: number, log?: (...args: unknown[]) => void }} [opts]
 */
export async function waitForArticleProduction(slug, opts = {}) {
  const {
    verifyFn = verifyArticleUrl,
    deadlineMs = PRODUCTION_DEPLOY_WAIT_MS,
    pollMs = PRODUCTION_DEPLOY_POLL_MS,
    log = console.log,
  } = opts;

  const deadline = Date.now() + deadlineMs;
  let lastCheck = null;

  while (Date.now() < deadline) {
    lastCheck = await verifyFn(slug);
    if (lastCheck.ok) {
      return { ok: true, slug, url: lastCheck.url, status: lastCheck.status, checks: lastCheck.checks };
    }
    log('Waiting for production deploy...', lastCheck.reason || 'not ready');
    await new Promise((r) => setTimeout(r, pollMs));
  }

  lastCheck = lastCheck || (await verifyFn(slug));
  return {
    ok: false,
    slug,
    url: lastCheck?.url,
    reason: lastCheck?.reason || 'timeout',
  };
}
