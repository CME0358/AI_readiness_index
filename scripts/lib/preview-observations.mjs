/**
 * preview-observations.mjs — JS mirror of observations/resolver.py (deterministic, no LLM).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CATALOG_PATH = path.resolve(
  ROOT,
  '../GEO Search Protocol/form-auto-sender/observations/catalog.json',
);
const SNAPSHOT_DIR = path.join(ROOT, 'data/preview_snapshots');

let catalogCache = null;

export function loadCatalog() {
  if (!catalogCache) {
    catalogCache = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  }
  return catalogCache;
}

export function resetCatalogCache() {
  catalogCache = null;
}

function asInt(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function asBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['1', 'true', 'yes'].includes(value.trim().toLowerCase());
  }
  return Boolean(value);
}

export function normalizeCrawlerRow(row = {}) {
  const reservationUrl = String(row.reservation_url || '').trim();
  return {
    evidence_source: row.evidence_source || 'reservation_crawler',
    site_reachable: asBool(row.site_reachable ?? true),
    faq: asInt(row.faq ?? row.FAQ),
    schema_org: asInt(row.schema_org ?? row['Schema.org']),
    reservation_button: asInt(row.reservation_button ?? row['予約ボタン']),
    local_business: asInt(row.local_business ?? row.LocalBusiness),
    reservation_action: asInt(row.reservation_action ?? row.ReservationAction),
    sns_link: asInt(row.sns_link ?? row['SNSリンク']),
    google_map_embed: asInt(row.google_map_embed ?? row['GoogleMap埋め込み']),
    has_reservation_url: Boolean(reservationUrl),
    reservation_url: reservationUrl,
    has_llms_txt: asBool(row.has_llms_txt ?? false),
    has_robots_txt: asBool(row.has_robots_txt ?? false),
    run_date: String(row.run_date || '').trim(),
    clinic_name: String(row.clinic_name || row['店舗名'] || '').trim(),
    url: String(row.url || row['HP URL'] || '').trim(),
  };
}

export function normalizeGenericRow(row = {}) {
  return {
    evidence_source: 'generic_scan',
    site_reachable: asBool(row.site_reachable ?? false),
    action_path_scanned: asBool(row.action_path_scanned ?? false),
    action_path_present: asBool(row.action_path_present ?? false),
    faq_scanned: asBool(row.faq_scanned ?? false),
    faq_present: asBool(row.faq_present ?? false),
    schema_scanned: asBool(row.schema_scanned ?? false),
    schema_present: asBool(row.schema_present ?? false),
    service_info_scanned: asBool(row.service_info_scanned ?? false),
    service_info_ok: asBool(row.service_info_ok ?? false),
    service_info_weak: asBool(row.service_info_weak ?? false),
    llms_txt_scanned: asBool(row.llms_txt_scanned ?? false),
    has_llms_txt: asBool(row.has_llms_txt ?? false),
    scanned_at: String(row.scanned_at || '').trim(),
    url: String(row.url || row.website_url || '').trim(),
  };
}

export function normalizeEvidenceRow(row = {}) {
  if ((row.evidence_source || '') === 'generic_scan') {
    return normalizeGenericRow(row);
  }
  return normalizeCrawlerRow(row);
}

function catalogObservationsForRow(normalized) {
  const catalog = loadCatalog();
  const src = normalized.evidence_source || 'reservation_crawler';
  const out = [];
  for (const obs of catalog.observations || []) {
    const obsSrc = obs.evidence_source;
    if (src === 'generic_scan') {
      if (obsSrc !== undefined && obsSrc !== 'generic_scan') continue;
      if (obsSrc === undefined && obs.code !== 'OBS_SITE_UNREACHABLE') continue;
    } else if (obsSrc === 'generic_scan') {
      continue;
    }
    out.push(obs);
  }
  return out;
}

function evalCondition(evidence, data) {
  if (evidence.any_of) {
    return evidence.any_of.some((item) => evalCondition(item, data));
  }
  if (evidence.all_of) {
    return evidence.all_of.every((item) => evalCondition(item, data));
  }

  const field = evidence.field;
  if (!field) return false;
  const actual = data[field];
  const op = evidence.operator || '==';

  if (op === '==') {
    const expected = evidence.value ?? evidence.threshold;
    if (typeof expected === 'boolean') return asBool(actual) === expected;
    return asInt(actual) === asInt(expected);
  }
  if (op === '>=') return asInt(actual) >= asInt(evidence.threshold ?? 0);
  if (op === '>') return asInt(actual) > asInt(evidence.threshold ?? 0);
  if (op === '<') return asInt(actual) < asInt(evidence.threshold ?? 0);
  if (op === 'between') {
    const val = asInt(actual);
    return asInt(evidence.min ?? 0) <= val && val <= asInt(evidence.max ?? 0);
  }
  return false;
}

export function resolveObservations(data) {
  const normalized = normalizeEvidenceRow(data);
  const matched = [];

  for (const obs of catalogObservationsForRow(normalized)) {
    if (evalCondition(obs.source_evidence || {}, normalized)) {
      matched.push({
        code: obs.code,
        approved_copy: obs.approved_copy || '',
        qualification: obs.qualification || '',
        severity: obs.severity || 'medium',
        display_priority: obs.display_priority ?? 100,
        check_item_id: obs.check_item_id,
        check_status: obs.check_status,
      });
    }
  }

  matched.sort((a, b) => a.display_priority - b.display_priority);
  return matched;
}

export function selectMessageObservations(data, maxCount) {
  const catalog = loadCatalog();
  const limit = maxCount ?? Number(catalog.max_observations_per_message ?? 2);
  const filtered = resolveObservations(data).filter(
    (o) => o.code !== 'OBS_SITE_UNREACHABLE' && o.approved_copy,
  );
  return filtered.slice(0, limit);
}

export function buildCheckSummary(data) {
  const catalog = loadCatalog();
  const normalized = normalizeEvidenceRow(data);
  if (!normalized.site_reachable) {
    return {
      checked_count: 0,
      total_teaser: Number(catalog.preview_teaser_total ?? 23),
      check_items: [],
      blocked: true,
    };
  }

  const itemDefs = Object.fromEntries((catalog.check_items || []).map((item) => [item.id, item]));
  const statuses = Object.fromEntries(Object.keys(itemDefs).map((id) => [id, 'unknown']));
  const rank = { unknown: 0, warn: 1, pass: 2 };

  for (const obs of resolveObservations(data)) {
    const itemId = obs.check_item_id;
    const status = obs.check_status;
    if (!itemId || statuses[itemId] === undefined || !status) continue;
    if ((rank[status] ?? 0) >= (rank[statuses[itemId]] ?? 0)) {
      statuses[itemId] = status;
    }
  }

  const checkItems = Object.keys(itemDefs).map((itemId) => ({
    id: itemId,
    label: itemDefs[itemId].label,
    status: statuses[itemId],
  }));
  const checkedCount = checkItems.filter((item) => item.status === 'pass' || item.status === 'warn').length;

  return {
    checked_count: checkedCount,
    total_teaser: Number(catalog.preview_teaser_total ?? 23),
    check_items: checkItems,
    blocked: false,
  };
}

export { publicSnapshotView } from './preview-snapshot-schema.mjs';
export {
  loadSnapshot,
  saveSnapshot,
  getPreviewSnapshotStore,
  resetPreviewSnapshotStore,
  MemoryPreviewSnapshotStore,
  PreviewStoreError,
} from './preview-snapshot-store.mjs';
