/**
 * Dual-fire canonical P0 aliases alongside legacy GA4 event names.
 * Used by report bundle (import) and tested server-side.
 */

import { CANONICAL_FUNNEL_EVENTS, MEASUREMENT_SCHEMA_VERSION } from './event-dictionary.mjs';

const ALIAS_BY_PRIMARY = Object.freeze({
  report_start: CANONICAL_FUNNEL_EVENTS.DIAGNOSIS_START,
  report_result_view: CANONICAL_FUNNEL_EVENTS.DIAGNOSIS_COMPLETE,
  lead_created: CANONICAL_FUNNEL_EVENTS.LEAD_SUBMIT_SUCCESS,
  purchase_verified: CANONICAL_FUNNEL_EVENTS.PURCHASE,
});

const PII_FIELDS = new Set(['email', 'company', 'domain', 'url', 'name', 'note', 'host', 'referrer', 'firstTouch', 'lastTouch', 'attribution']);

function sanitizeParams(params = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(params)) {
    if (PII_FIELDS.has(key)) continue;
    if (value === undefined || value === null) continue;
    safe[key] = value;
  }
  return safe;
}

function buildAliasPayload(primaryEvent, params = {}) {
  const alias = ALIAS_BY_PRIMARY[primaryEvent];
  if (!alias) return null;
  if (primaryEvent === 'purchase_verified' && params.verified !== true) return null;
  const safe = sanitizeParams(params);
  return {
    aliasEvent: alias,
    params: {
      ...safe,
      canonical_source_event: primaryEvent,
      measurement_schema: MEASUREMENT_SCHEMA_VERSION,
    },
  };
}

/**
 * @param {(name: string, params: object) => void} send — typically gtag('event', ...)
 */
function emitWithCanonicalAlias(send, primaryEvent, params = {}) {
  if (typeof send !== 'function') return { primaryEvent, aliasEvent: null };
  const safe = sanitizeParams(params);
  send(primaryEvent, safe);
  const alias = buildAliasPayload(primaryEvent, params);
  if (alias) send(alias.aliasEvent, alias.params);
  return { primaryEvent, aliasEvent: alias?.aliasEvent || null };
}

function createDedupeStore(storage) {
  return {
    once(key) {
      if (!key || !storage) return true;
      try {
        if (storage.getItem(key) === '1') return false;
        storage.setItem(key, '1');
        return true;
      } catch {
        return true;
      }
    },
  };
}

function purchaseDedupeKey(reference) {
  return reference ? `ari_ga_purchase:${reference}` : '';
}

function leadSuccessDedupeKey(leadId) {
  return leadId ? `ari_ga_lead_success:${leadId}` : '';
}

export {
  ALIAS_BY_PRIMARY,
  sanitizeParams,
  buildAliasPayload,
  emitWithCanonicalAlias,
  createDedupeStore,
  purchaseDedupeKey,
  leadSuccessDedupeKey,
};
