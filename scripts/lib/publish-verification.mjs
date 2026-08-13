/**
 * Production URL verification with bounded retry delays.
 * Delays between attempts: 30s, 60s, 120s, 180s (max ~6.5 min wait + request time).
 */
import { verifyArticleUrl } from './url-verify.mjs';

export const VERIFICATION_RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 180_000];

export function totalVerificationBudgetMs() {
  return VERIFICATION_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {string} slug
 * @param {{ verifyFn?: typeof verifyArticleUrl, delays?: number[], log?: (...args: unknown[]) => void, dryRun?: boolean }} [opts]
 */
export async function verifyProductionWithBoundedRetry(slug, opts = {}) {
  const {
    verifyFn = verifyArticleUrl,
    delays = VERIFICATION_RETRY_DELAYS_MS,
    log = console.log,
    dryRun = false,
  } = opts;

  let attempt = 0;
  let lastResult = null;

  while (true) {
    attempt += 1;
    if (dryRun) {
      return {
        ok: true,
        slug,
        url: `https://readiness.coaretail.com/insights/${slug}/`,
        attempts: attempt,
        dryRun: true,
      };
    }

    lastResult = await verifyFn(slug);
    if (lastResult.ok) {
      return {
        ok: true,
        slug,
        url: lastResult.url,
        status: lastResult.status,
        attempts: attempt,
        checks: lastResult.checks,
      };
    }

    const delayMs = delays[attempt - 1];
    if (delayMs == null) {
      return {
        ok: false,
        slug,
        url: lastResult.url,
        reason: lastResult.reason || 'verification_exhausted',
        attempts: attempt,
      };
    }

    log(`Production verify attempt ${attempt} failed (${lastResult.reason}); retry in ${delayMs / 1000}s`);
    await sleep(delayMs);
  }
}
