import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SEGMENTS } from '../lib/funnel/segments.mjs';
import { createEventPayload, FUNNEL_EVENTS } from '../lib/funnel/events.mjs';
import { resolveLeadRoute } from '../lib/funnel/routing.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('Direct Buyer routes to LocalGeo with the preserved UTM contract and user action', () => {
  const route = resolveLeadRoute({ segment: SEGMENTS.DIRECT_BUYER, confidence: 0.94 });
  assert.equal(route.action, 'LOCAL');
  assert.equal(route.destinationType, 'LOCALGEO');
  assert.equal(new URL(route.destination).host, 'localgeo.coaretail.com');
  assert.equal(new URL(route.destination).searchParams.get('utm_source'), 'ari_preview');
  assert.equal(new URL(route.destination).searchParams.get('utm_medium'), 'outbound');
  assert.equal(new URL(route.destination).searchParams.get('utm_campaign'), 'direct_buyer');
  assert.equal(new URL(route.destination).searchParams.get('utm_content'), 'lead_routing');
  assert.equal(route.requiresUserAction, true);
});

test('Agent Partner routes to the Company Report', () => {
  const route = resolveLeadRoute({ segment: SEGMENTS.AGENT_PARTNER, confidence: 0.9 });
  assert.deepEqual({ action: route.action, destination: route.destination, destinationType: route.destinationType }, { action: 'REPORT', destination: '/report/', destinationType: 'REPORT' });
  assert.equal(route.confidenceBand, 'HIGH');
});

test('Unknown and low-confidence classifications stay neutral', () => {
  const unknown = resolveLeadRoute({ segment: SEGMENTS.UNKNOWN, confidence: 0 });
  const lowDirect = resolveLeadRoute({ segment: SEGMENTS.DIRECT_BUYER, confidence: 0.4 });
  for (const route of [unknown, lowDirect]) {
    assert.equal(route.action, 'LEARN');
    assert.equal(route.destination, '/framework/');
    assert.equal(route.segment, SEGMENTS.UNKNOWN);
    assert.equal(route.confidenceBand, 'LOW');
  }
});

test('Medium confidence may recommend but remains user-confirmed', () => {
  const route = resolveLeadRoute({ segment: SEGMENTS.AGENT_PARTNER, confidence: 0.7 });
  assert.equal(route.action, 'REPORT');
  assert.equal(route.confidenceBand, 'MEDIUM');
  assert.equal(route.requiresUserAction, true);
});

test('Routing analytics allowlist contains routing fields but excludes PII', () => {
  const payload = createEventPayload(FUNNEL_EVENTS.ROUTING_DECISION, {
    segment: SEGMENTS.DIRECT_BUYER, action: 'LOCAL', confidenceBand: 'HIGH', destinationType: 'LOCALGEO', email: 'person@example.com', company: 'Example', schemaVersion: '1',
  });
  assert.equal(payload.event, 'routing_decision');
  assert.equal(payload.action, 'LOCAL');
  assert.equal(payload.destinationType, 'LOCALGEO');
  assert.equal(payload.email, undefined);
  assert.equal(payload.company, undefined);
});

test('Whitepaper success state preserves Download and does not auto-redirect', () => {
  const html = read('whitepaper/2026/free/index.html');
  const script = read('assets/whitepaper-lead-capture.js');
  assert.match(html, /data-lead-routing/);
  assert.match(html, /data-whitepaper-download/);
  assert.doesNotMatch(script, /window\.location\.(href|assign|replace)/);
});

test('Routing metadata is passed through the server LeadRepository adapter', () => {
  const source = read('api/whitepaper-lead.js');
  assert.match(source, /resolveLeadRoute/);
  assert.match(source, /routeAction: route\.action/);
  assert.match(read('api/_lib/airtable.cjs'), /route_confidence_band/);
  assert.match(source, /confidence: built\.classification\.confidence, route \}/);
});
