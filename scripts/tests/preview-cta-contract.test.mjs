import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { publicSnapshotView } from '../lib/preview-snapshot-schema.mjs';
import { resolvePublicPreviewCta } from '../../report/src/preview-cta-contract.js';

const base = { token: 'opaque-token', candidate_id: 'candidate-123', company_name: 'Sensitive Co',
  url: 'https://sensitive.example/', preview: { observations: [], check_summary: {} }, routing_policy_version: 'ARI_CONVERSION_ROUTING_V1' };
const direct = { ...base, buyer_type: 'DIRECT_BUYER', route_id: 'DIRECT_BUYER_V1',
  cta_destination: 'https://localgeo.coaretail.com/',
  cta_tracking_url: 'https://localgeo.coaretail.com/?utm_campaign=direct_buyer&utm_content=direct_buyer_v1&utm_medium=outbound&utm_source=ari_preview' };
const agency = { ...base, buyer_type: 'AGENCY_PARTNER', route_id: 'AGENCY_PARTNER_V1',
  cta_destination: 'https://readiness.coaretail.com/report/partner-preview/',
  cta_tracking_url: 'https://readiness.coaretail.com/report/partner-preview/?utm_campaign=agency_partner&utm_content=agency_partner_v1&utm_medium=outbound&utm_source=ari_preview' };

test('Direct Buyer snapshot resolves deterministic Local GEO CTA', () => {
  const cta = resolvePublicPreviewCta(direct);
  assert.equal(new URL(cta.trackingUrl).hostname, 'localgeo.coaretail.com');
});
test('Agency Partner snapshot preserves approved readiness CTA', () => {
  assert.equal(resolvePublicPreviewCta(agency).destination, 'https://readiness.coaretail.com/report/partner-preview/');
});
test('tracking is deterministic and excludes sensitive identity', () => {
  const first = resolvePublicPreviewCta(direct).trackingUrl;
  assert.equal(first, resolvePublicPreviewCta({ ...direct }).trackingUrl);
  const query = new URL(first).search.toLowerCase();
  for (const value of [direct.company_name, direct.url, direct.candidate_id, direct.token]) assert.equal(query.includes(value.toLowerCase()), false);
});
test('arbitrary, malformed, extra-query, and mismatched routes fail closed', () => {
  assert.equal(resolvePublicPreviewCta({ ...direct, cta_tracking_url: 'https://evil.example/' }), null);
  assert.equal(resolvePublicPreviewCta({ ...direct, cta_tracking_url: 'not-a-url' }), null);
  assert.equal(resolvePublicPreviewCta({ ...direct, cta_tracking_url: `${direct.cta_tracking_url}&company=secret` }), null);
  assert.equal(resolvePublicPreviewCta({ ...direct, buyer_type: 'AGENCY_PARTNER' }), null);
});
test('missing and legacy CTA metadata disable CTA safely', () => {
  assert.equal(resolvePublicPreviewCta(base), null);
  const view = publicSnapshotView(base);
  assert.equal(view.cta_available, false);
  assert.equal(view.cta_tracking_url, null);
});
test('public projection exposes safe CTA and strips internal evidence', () => {
  const view = publicSnapshotView({ ...direct, _evidence: { raw: 'secret' }, candidate_binding_fingerprint: 'internal' });
  assert.equal(view.cta_available, true);
  assert.equal(view.route_id, 'DIRECT_BUYER_V1');
  assert.equal(view._evidence, undefined);
  assert.equal(view.candidate_binding_fingerprint, undefined);
});
test('PreviewPage uses validated CTA and has no hard-coded report redirect', () => {
  const source = fs.readFileSync(new URL('../../report/src/PreviewPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /resolvePublicPreviewCta\(data\)/);
  assert.match(source, /window\.location\.assign\(cta\.trackingUrl\)/);
  assert.doesNotMatch(source, /window\.location\.href\s*=\s*["']\/report\//);
});
