/**
 * /api/cron/publish-insights
 *
 * Primary trigger for weekday 10:00 JST Insights publish (+ chained Buffer queue).
 * Invoked during Vercel Hobby's 00:00 UTC precision window; the dispatched
 * workflow waits until 10:00 JST before mutating publication state.
 *
 * Required Vercel env:
 *   CRON_SECRET — Vercel sends Authorization: Bearer <CRON_SECRET>
 *   GITHUB_DISPATCH_TOKEN — PAT with repo + workflow (actions:write)
 * Optional:
 *   GITHUB_REPOSITORY — default CME0358/AI_readiness_index
 */
import { handlePublishInsightsCron } from '../../scripts/lib/github-workflow-dispatch.mjs';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  const { status, body } = await handlePublishInsightsCron(req);
  res.statusCode = status;
  res.end(JSON.stringify(body));
}
