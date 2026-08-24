/**
 * preview-snapshot-schema.mjs — Public-safe snapshot view + validation helpers.
 */

import { normalizeVideoSegment } from './video-segment.mjs';
import { resolvePublicPreviewCta } from '../../report/src/preview-cta-contract.js';

export const SNAPSHOT_TTL_SECONDS = 90 * 24 * 60 * 60;
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export function isValidToken(token) {
  return typeof token === 'string' && TOKEN_PATTERN.test(token) && token.length <= 128;
}

export function isExpiredSnapshot(snapshot) {
  const expires = snapshot?.expires_at;
  if (!expires) return false;
  const expMs = Date.parse(expires);
  return Number.isFinite(expMs) && Date.now() > expMs;
}

export function publicSnapshotView(snapshot) {
  const preview = snapshot?.preview || {};
  const cta = resolvePublicPreviewCta(snapshot);
  return {
    token: snapshot?.token,
    company_name: snapshot?.company_name,
    url: snapshot?.url,
    industry: snapshot?.industry,
    candidate_id: snapshot?.candidate_id,
    campaign_id: snapshot?.campaign_id,
    template_version: snapshot?.template_version,
    crawled_at: snapshot?.crawled_at,
    created_at: snapshot?.created_at,
    video_segment: normalizeVideoSegment(snapshot?.video_segment),
    observations: preview.observations || [],
    check_summary: preview.check_summary || {},
    cta_available: Boolean(cta),
    route_id: cta?.routeId || null,
    buyer_type: cta?.buyerType || null,
    cta_destination: cta?.destination || null,
    cta_tracking_url: cta?.trackingUrl || null,
    routing_policy_version: cta?.routingPolicyVersion || null,
  };
}

export function serializeSnapshot(snapshot) {
  return JSON.stringify(snapshot);
}

export function deserializeSnapshot(raw) {
  if (!raw) return null;
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}
