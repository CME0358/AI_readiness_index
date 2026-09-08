import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_INVENTORY, getInventorySummary } from '../lib/referral/inventory.mjs';
import { BUSINESS_INFO_PACK } from '../lib/referral/business-info.mjs';
import { EDITORIAL_MIX_P3, mixTotalPct, weeklySlotAllocation } from '../lib/referral/editorial-mix.mjs';
import { LANDING_ROUTES, buildReferralUrl, routesByAudience } from '../lib/referral/landing-routes.mjs';
import { buildReferralRedirects } from '../lib/referral/redirect-manifest.mjs';
import { POST_DRAFTS, validateDraftForMedia } from '../lib/referral/post-drafts.mjs';
import { validateReferralDestination, assertNoSidecarShortIdCollision } from '../lib/referral/redirect-validator.mjs';
import { utf16Length } from '../x-traffic-sidecar/core.mjs';
import redirectHandler from '../../api/go/[short_id].js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function mockRes() {
  const out = { statusCode: 200, headers: {}, location: null, body: '' };
  return {
    out,
    res: {
      status(code) { out.statusCode = code; return this; },
      setHeader(k, v) { out.headers[k] = v; },
      redirect(code, loc) { out.statusCode = code; out.location = loc; },
      end(b) { out.body = b; },
    },
  };
}

describe('ARI-P3-01 referral', () => {
  it('inventory has one publishable case study with permission notes', () => {
    const s = getInventorySummary();
    assert.equal(s.caseStudyCount, 1);
    assert.ok(ASSET_INVENTORY.caseStudies[0].permissionNote);
    assert.ok(ASSET_INVENTORY.externalIntroForbidden.some((x) => x.includes('来店')));
  });

  it('business info keeps canonical pricing', () => {
    assert.match(BUSINESS_INFO_PACK.pricing.companyReport, /29,800/);
    assert.match(BUSINESS_INFO_PACK.pricing.localGeoMonthly, /60,000/);
    assert.match(BUSINESS_INFO_PACK.evidence.notEvidence, /転載/);
  });

  it('editorial mix sums to 100% and does not modify buffer', () => {
    assert.equal(mixTotalPct(), 100);
    assert.equal(EDITORIAL_MIX_P3.bufferPolicy, 'DO_NOT_MODIFY_SCHEDULED');
    const slots = weeklySlotAllocation(10);
    const total = Object.values(slots).reduce((n, b) => n + b.slots, 0);
    assert.equal(total, 10);
  });

  it('landing routes cover enterprise, store, partner', () => {
    for (const aud of ['enterprise', 'store', 'partner']) {
      assert.ok(routesByAudience(aud).length >= 2);
    }
    const url = buildReferralUrl(LANDING_ROUTES[0], { content: 'test' });
    assert.match(url, /utm_campaign=ari_ref_enterprise/);
  });

  it('referral redirects are valid and do not collide with x-sidecar', () => {
    const manifest = buildReferralRedirects();
    const sidecar = JSON.parse(fs.readFileSync(
      path.join(ROOT, 'insights/_social/x-sidecar/redirects.json'),
      'utf8',
    ));
    const collision = assertNoSidecarShortIdCollision(
      manifest.redirects.map((r) => r.short_id),
      sidecar.redirects.map((r) => r.short_id),
    );
    assert.ok(collision.ok);
    for (const r of manifest.redirects) {
      assert.ok(r.short_id.startsWith('ref'), r.short_id);
      assert.ok(validateReferralDestination(r.destination), r.short_id);
    }
  });

  it('defines 6 post drafts with media validation', () => {
    assert.equal(POST_DRAFTS.length, 6);
    const buckets = new Set(POST_DRAFTS.map((d) => d.bucket));
    assert.ok(buckets.has('pre_purchase_questions'));
    assert.ok(buckets.has('case_studies'));
    for (const draft of POST_DRAFTS.filter((d) => d.media === 'x')) {
      const shortUrl = draft.shortId ? `https://readiness.coaretail.com/go/${draft.shortId}` : null;
      const v = validateDraftForMedia(draft, { shortUrl, utf16Len: utf16Length });
      assert.ok(v.ok, `${draft.id}: ${v.errors.join(', ')}`);
    }
  });

  it('case study draft does not claim visit uplift', () => {
    const caseDraft = POST_DRAFTS.find((d) => d.id === 'draft-02');
    assert.ok(caseDraft.body.includes('増加率は公開していません'));
    assert.doesNotMatch(caseDraft.body, /来店数が\d|売上が\d|増加率\d+%/);
  });

  it('api /go handler resolves referral and preserves sidecar', () => {
    const sidecar = mockRes();
    redirectHandler({ query: { short_id: 'x260908d' } }, sidecar.res);
    assert.equal(sidecar.out.statusCode, 302);
    assert.match(sidecar.out.location, /insights\/recommendation-logic/);

    const referral = mockRes();
    redirectHandler({ query: { short_id: 'ref2609e1' } }, referral.res);
    assert.equal(referral.out.statusCode, 302);
    assert.equal(referral.out.headers['X-Redirect-Kind'], 'referral');
    assert.match(referral.out.location, /utm_campaign=ari_ref_enterprise/);
    assert.match(referral.out.location, /\/report\//);

    const unknown = mockRes();
    redirectHandler({ query: { short_id: 'notreal1' } }, unknown.res);
    assert.equal(unknown.out.statusCode, 404);
  });

  it('cases hub includes audience-specific /go/ CTAs', () => {
    const html = fs.readFileSync(path.join(ROOT, 'cases/index.html'), 'utf8');
    assert.match(html, /ref2609e1/);
    assert.match(html, /ref2609s1/);
    assert.match(html, /ref2609p1/);
    assert.match(html, /data-funnel-cta/);
  });
});
