import { NOTIFY_SEVERITIES } from './constants.mjs';
import { formatSlackMessageJa } from './slack-message-ja.mjs';

export { formatSlackMessageJa, formatSlackMessageJa as formatSlackMessage } from './slack-message-ja.mjs';

export function getWebhookUrl() {
  return process.env.ABIS_SLACK_WEBHOOK_URL || '';
}

export function shouldNotify(impact) {
  return NOTIFY_SEVERITIES.has(impact.severity);
}

function sanitizeError(err) {
  const msg = err?.message || String(err);
  return msg.replace(/https?:\/\/[^\s]+/gi, '[REDACTED_URL]');
}

function redactSecretsFromText(text) {
  return String(text).replace(
    /https:\/\/hooks\.slack\.com\/services\/[^\s'"]+/gi,
    'https://hooks.slack.com/services/[REDACTED]',
  );
}

/**
 * Send Slack notification or dry-run preview.
 * Never throws — failures return notification_status FAILED.
 */
export async function notifyAbisImpact(impact, options = {}) {
  const {
    dryRun = true,
    notify = false,
    title,
    ari_article_status,
    announcement_excerpt,
  } = options;
  const wouldNotify = shouldNotify(impact);

  if (!wouldNotify) {
    return { would_notify: false, notification_status: 'SKIPPED', sent: false };
  }

  let preview;
  try {
    preview = formatSlackMessageJa(impact, {
      title,
      ari_article_status,
      announcement_excerpt,
    });
  } catch (err) {
    return {
      would_notify: true,
      notification_status: 'FAILED',
      sent: false,
      error: sanitizeError(err),
    };
  }

  if (dryRun || !notify) {
    return {
      would_notify: true,
      notification_status: 'DRY_RUN',
      sent: false,
      preview,
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
      body: JSON.stringify({ text: preview }),
    });
    if (!res.ok) {
      return {
        would_notify: true,
        notification_status: 'FAILED',
        sent: false,
        error: sanitizeError(new Error(`HTTP ${res.status}`)),
      };
    }
    return { would_notify: true, notification_status: 'SENT', sent: true, preview };
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
  return redactSecretsFromText(text);
}
