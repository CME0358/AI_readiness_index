import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NURTURE_STATUSES, NURTURE_TRACKS, MESSAGE_TYPES, TRACK_PRIORITY, TRACK_CONFIG, TIMING_CONFIG,
  eligibility, chooseTrack, createNurtureDecision, createMessage, nurtureTouch, messageDedupeKey, createNurtureRepository, createEmailProvider,
} from '../lib/funnel/nurture.mjs';
import { createEventPayload } from '../lib/funnel/events.mjs';

test('eligibility requires valid email, consent and explicit marketing consent', () => {
  assert.deepEqual(eligibility({ email: 'a@example.com', consent: true, marketingConsent: true }), { eligible: true, status: NURTURE_STATUSES.ELIGIBLE, reason: 'eligible' });
  assert.equal(eligibility({ email: 'a@example.com', consent: false, marketingConsent: true }).status, NURTURE_STATUSES.SUPPRESSED);
  assert.equal(eligibility({ email: 'a@example.com', consent: true, marketingConsent: false }).reason, 'marketing_consent_unknown');
  assert.equal(eligibility({ email: 'a@example.com', consent: true, marketingConsent: true, unsubscribed: true }).status, NURTURE_STATUSES.UNSUBSCRIBED);
  assert.equal(eligibility({ email: '', consent: true, marketingConsent: true }).reason, 'invalid_email');
});

test('track selection separates Direct Buyer, Partner bands, Report Buyer and Unknown', () => {
  assert.equal(chooseTrack({ segment: 'DIRECT_BUYER' }), NURTURE_TRACKS.DIRECT_BUYER);
  assert.equal(chooseTrack({ segment: 'AGENT_PARTNER', qualificationBand: 'HIGH' }), NURTURE_TRACKS.QUALIFIED_PARTNER);
  assert.equal(chooseTrack({ segment: 'AGENT_PARTNER', qualificationBand: 'MEDIUM' }), NURTURE_TRACKS.QUALIFIED_PARTNER);
  assert.equal(chooseTrack({ segment: 'AGENT_PARTNER', qualificationBand: 'LOW' }), NURTURE_TRACKS.AGENT_PARTNER_LOW);
  assert.equal(chooseTrack({ segment: 'AGENT_PARTNER', reportPurchased: true }), NURTURE_TRACKS.REPORT_BUYER);
  assert.equal(chooseTrack({ segment: 'UNKNOWN' }), NURTURE_TRACKS.UNKNOWN_EDUCATION);
});

test('priority and message configuration are centralised', () => {
  assert.equal(TRACK_PRIORITY[0], NURTURE_TRACKS.QUALIFIED_PARTNER);
  assert.equal(TRACK_PRIORITY.at(-1), NURTURE_TRACKS.UNKNOWN_EDUCATION);
  assert.equal(TRACK_CONFIG[NURTURE_TRACKS.AGENT_PARTNER_HIGH].templateId, 'partner_high_01');
  assert.equal(TIMING_CONFIG.FOLLOW_UP_1, 2);
  assert.equal(TIMING_CONFIG.FOLLOW_UP_3, 10);
});

test('decision and message records are provider-independent and PII-free by shape', () => {
  const decision = createNurtureDecision({ leadId: 'lead_1', segment: 'AGENT_PARTNER', qualificationBand: 'HIGH', email: 'a@example.com', consent: true, marketingConsent: true });
  const message = createMessage({ leadId: decision.leadId, track: decision.track });
  assert.equal(decision.track, NURTURE_TRACKS.QUALIFIED_PARTNER);
  assert.equal(decision.eligible, true);
  assert.equal(message.messageType, MESSAGE_TYPES.PARTNER_FOLLOWUP);
  assert.equal(messageDedupeKey(message), 'lead_1:QUALIFIED_PARTNER:qualified_partner_01');
  assert.equal(message.email, undefined);
});

test('NurtureRepository prevents duplicate queue through adapter key', async () => {
  const queued = [];
  const repository = createNurtureRepository({
    saveDecision: async (decision) => ({ saved: true, decision }),
    queueMessage: async (message, key) => { if (queued.includes(key)) return { queued: false, duplicate: true }; queued.push(key); return { queued: true, key }; },
    updateStatus: async () => ({ updated: true }),
    findByLead: async () => queued,
  });
  const message = createMessage({ leadId: 'lead_1', track: NURTURE_TRACKS.UNKNOWN_EDUCATION });
  assert.equal((await repository.queueMessage(message)).queued, true);
  assert.equal((await repository.queueMessage(message)).duplicate, true);
});

test('EmailProvider is a no-send stub until a provider is selected', async () => {
  const provider = createEmailProvider();
  assert.deepEqual(await provider.sendTemplate({ templateId: 'partner_high_01' }), { sent: false, reason: 'not_configured' });
});

test('nurture analytics allowlist excludes PII and message body', () => {
  const payload = createEventPayload('nurture_queued', { track: 'AGENT_PARTNER_HIGH', templateId: 'partner_high_01', messageType: 'PARTNER_FOLLOWUP', status: 'QUEUED', email: 'a@example.com', company: 'Example', note: 'private', body: 'private' });
  assert.equal(payload.track, 'AGENT_PARTNER_HIGH');
  assert.equal(payload.email, undefined);
  assert.equal(payload.company, undefined);
  assert.equal(payload.note, undefined);
  assert.equal(payload.body, undefined);
});

test('nurture conversion attribution can update last touch without changing first touch', () => {
  const touch = nurtureTouch('AGENT_PARTNER_HIGH', '2026-08-27T00:00:00.000Z');
  assert.deepEqual(touch, { source: 'ari_nurture', medium: 'email', campaign: 'agent_partner_high', landingPage: '', referrer: '', capturedAt: '2026-08-27T00:00:00.000Z' });
});
