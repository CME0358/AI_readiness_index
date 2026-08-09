import { NOTIFY_SEVERITIES } from './constants.mjs';

export function getWebhookUrl() {
  return process.env.ABIS_SLACK_WEBHOOK_URL || '';
}

export function shouldNotify(impact) {
  return NOTIFY_SEVERITIES.has(impact.severity);
}

export function formatSlackMessage(impact, { title, ari_article_status = 'UNKNOWN' } = {}) {
  const emoji = impact.severity === 'CRITICAL' ? '🚨' : '⚠️';
  return [
    `${emoji} ABIS IMPACT WATCH — ${impact.severity}`,
    '',
    'Source:',
    impact.company,
    '',
    'Announcement:',
    title || impact.event_id,
    '',
    'Published:',
    impact.source_date || 'UNKNOWN',
    '',
    'ABIS Impact:',
    `${impact.abis_impact_score}/100`,
    '',
    'Affected Areas:',
    (impact.affected_areas || []).join(', ') || '(none)',
    '',
    'Why It Matters:',
    impact.reasoning_summary,
    '',
    'Recommended Action:',
    impact.recommended_action,
    '',
    'Confidence:',
    impact.confidence,
    '',
    'Source:',
    impact.source_url,
    '',
    'ARI Editorial Status:',
    ari_article_status,
  ].join('\n');
}

function sanitizeError(err) {
  const msg = err?.message || String(err);
  return msg.replace(/https?:\/\/[^\s]+/gi, '[REDACTED_URL]');
}

/**
 * Send Slack notification or dry-run preview.
 * Never throws — failures return notification_status FAILED.
 */
export async function notifyAbisImpact(impact, options = {}) {
  const { dryRun = true, notify = false, title, ari_article_status } = options;
  const wouldNotify = shouldNotify(impact);

  if (!wouldNotify) {
    return { would_notify: false, notification_status: 'SKIPPED', sent: false };
  }

  if (dryRun || !notify) {
    return {
      would_notify: true,
      notification_status: 'DRY_RUN',
      sent: false,
      preview: formatSlackMessage(impact, { title, ari_article_status }),
    };
  }

  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    return {
      would_notify: true,
      notification_status: 'FAILED',
      sent: false,
      error: 'ABIS_SLACK_WEBHOOK_URL not configured',
    };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: formatSlackMessage(impact, { title, ari_article_status }) }),
    });
    if (!res.ok) {
      return {
        would_notify: true,
        notification_status: 'FAILED',
        sent: false,
        error: sanitizeError(new Error(`HTTP ${res.status}`)),
      };
    }
    return { would_notify: true, notification_status: 'SENT', sent: true };
  } catch (err) {
    return {
      would_notify: true,
      notification_status: 'FAILED',
      sent: false,
      error: sanitizeError(err),
    };
  }
}

/** Redact webhook URLs from log strings. */
export function sanitizeLogMessage(text) {
  return String(text).replace(
    /https:\/\/hooks\.slack\.com\/services\/[^\s'"]+/gi,
    'https://hooks.slack.com/services/[REDACTED]',
  );
}
