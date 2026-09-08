/**
 * Validate per-channel social copy before scheduling / unlock.
 */
import path from 'node:path';
import { ROOT, articleUrl } from './insights-v2-paths.mjs';
import { CHANNEL_KEYS, CHANNEL_CONTENT_DIRS } from './social-channels.mjs';
import { loadChannelText, validateChannelContent } from './buffer-dispatcher.mjs';

export function validateSocialContentForSlug(slug, { root = ROOT, articleUrlOverride = null } = {}) {
  const url = articleUrlOverride || articleUrl(slug);
  const errors = [];

  for (const channel of CHANNEL_KEYS) {
    const rel = `${CHANNEL_CONTENT_DIRS[channel]}/${slug}.md`;
    const abs = path.join(root, rel);
    try {
      const text = loadChannelText(abs);
      const result = validateChannelContent(channel, text, url);
      if (!result.ok) {
        errors.push({ channel, file: rel, errors: result.errors });
      }
    } catch (error) {
      errors.push({ channel, file: rel, errors: [String(error?.message || error)] });
    }
  }

  return {
    ok: errors.length === 0,
    slug,
    errors,
  };
}

export function formatSocialValidationFailure(validation) {
  if (validation.ok) return '';
  return validation.errors
    .map(({ channel, errors }) => `${channel}: ${errors.join('; ')}`)
    .join(' | ');
}
