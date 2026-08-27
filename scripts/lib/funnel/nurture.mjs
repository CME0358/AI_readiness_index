const NURTURE_STATUSES = Object.freeze({ NONE: 'NONE', ELIGIBLE: 'ELIGIBLE', QUEUED: 'QUEUED', SENT: 'SENT', ENGAGED: 'ENGAGED', CONVERTED: 'CONVERTED', PAUSED: 'PAUSED', UNSUBSCRIBED: 'UNSUBSCRIBED', SUPPRESSED: 'SUPPRESSED' });
const NURTURE_TRACKS = Object.freeze({ DIRECT_BUYER: 'DIRECT_BUYER', AGENT_PARTNER_HIGH: 'AGENT_PARTNER_HIGH', AGENT_PARTNER_MEDIUM: 'AGENT_PARTNER_MEDIUM', AGENT_PARTNER_LOW: 'AGENT_PARTNER_LOW', UNKNOWN_EDUCATION: 'UNKNOWN_EDUCATION', REPORT_BUYER: 'REPORT_BUYER', QUALIFIED_PARTNER: 'QUALIFIED_PARTNER' });
const MESSAGE_TYPES = Object.freeze({ WELCOME: 'WELCOME', EDUCATION: 'EDUCATION', REPORT_REMINDER: 'REPORT_REMINDER', QUALIFICATION_REMINDER: 'QUALIFICATION_REMINDER', PARTNER_FOLLOWUP: 'PARTNER_FOLLOWUP', CONSULTATION_FOLLOWUP: 'CONSULTATION_FOLLOWUP', LOCAL_HANDOFF: 'LOCAL_HANDOFF' });
const NURTURE_EVENTS = Object.freeze({ ELIGIBLE: 'nurture_eligible', QUEUED: 'nurture_queued', SENT: 'nurture_sent', ENGAGED: 'nurture_engaged', SUPPRESSED: 'nurture_suppressed' });
const NURTURE_SCHEMA_VERSION = '1';

const TRACK_PRIORITY = Object.freeze([
  NURTURE_TRACKS.QUALIFIED_PARTNER, NURTURE_TRACKS.REPORT_BUYER, NURTURE_TRACKS.AGENT_PARTNER_HIGH,
  NURTURE_TRACKS.AGENT_PARTNER_MEDIUM, NURTURE_TRACKS.AGENT_PARTNER_LOW, NURTURE_TRACKS.DIRECT_BUYER, NURTURE_TRACKS.UNKNOWN_EDUCATION,
]);
const TRACK_CONFIG = Object.freeze({
  [NURTURE_TRACKS.QUALIFIED_PARTNER]: { templateId: 'qualified_partner_01', messageType: MESSAGE_TYPES.PARTNER_FOLLOWUP, destinationType: 'PARTNER' },
  [NURTURE_TRACKS.REPORT_BUYER]: { templateId: 'report_buyer_01', messageType: MESSAGE_TYPES.QUALIFICATION_REMINDER, destinationType: 'REPORT' },
  [NURTURE_TRACKS.AGENT_PARTNER_HIGH]: { templateId: 'partner_high_01', messageType: MESSAGE_TYPES.PARTNER_FOLLOWUP, destinationType: 'PARTNER' },
  [NURTURE_TRACKS.AGENT_PARTNER_MEDIUM]: { templateId: 'partner_medium_01', messageType: MESSAGE_TYPES.EDUCATION, destinationType: 'PARTNER' },
  [NURTURE_TRACKS.AGENT_PARTNER_LOW]: { templateId: 'partner_low_01', messageType: MESSAGE_TYPES.EDUCATION, destinationType: 'LEARN' },
  [NURTURE_TRACKS.DIRECT_BUYER]: { templateId: 'direct_buyer_handoff_01', messageType: MESSAGE_TYPES.LOCAL_HANDOFF, destinationType: 'LOCALGEO' },
  [NURTURE_TRACKS.UNKNOWN_EDUCATION]: { templateId: 'unknown_education_01', messageType: MESSAGE_TYPES.EDUCATION, destinationType: 'LEARN' },
});
const TIMING_CONFIG = Object.freeze({ WELCOME: 0, FOLLOW_UP_1: 2, FOLLOW_UP_2: 5, FOLLOW_UP_3: 10 });

function eligibility(input = {}) {
  if (!String(input.email || '').trim() || input.emailValid === false) return { eligible: false, status: NURTURE_STATUSES.SUPPRESSED, reason: 'invalid_email' };
  if (input.consent !== true) return { eligible: false, status: NURTURE_STATUSES.SUPPRESSED, reason: 'no_consent' };
  if (input.unsubscribed === true) return { eligible: false, status: NURTURE_STATUSES.UNSUBSCRIBED, reason: 'unsubscribed' };
  if (input.suppressed === true) return { eligible: false, status: NURTURE_STATUSES.SUPPRESSED, reason: 'suppressed' };
  if (input.marketingConsent !== true) return { eligible: false, status: NURTURE_STATUSES.SUPPRESSED, reason: 'marketing_consent_unknown' };
  return { eligible: true, status: NURTURE_STATUSES.ELIGIBLE, reason: 'eligible' };
}

function chooseTrack(input = {}) {
  if (input.segment === 'DIRECT_BUYER') return NURTURE_TRACKS.DIRECT_BUYER;
  if (input.segment === 'AGENT_PARTNER') {
    if (input.qualificationBand === 'HIGH' || input.qualificationBand === 'MEDIUM') return NURTURE_TRACKS.QUALIFIED_PARTNER;
    if (input.qualificationBand === 'LOW') return NURTURE_TRACKS.AGENT_PARTNER_LOW;
    if (input.reportPurchased === true) return NURTURE_TRACKS.REPORT_BUYER;
    return NURTURE_TRACKS.AGENT_PARTNER_HIGH;
  }
  if (input.reportPurchased === true) return NURTURE_TRACKS.REPORT_BUYER;
  return NURTURE_TRACKS.UNKNOWN_EDUCATION;
}

function createNurtureDecision(input = {}) {
  const gate = eligibility(input);
  const track = chooseTrack(input);
  const config = TRACK_CONFIG[track];
  return { leadId: input.leadId || '', track, eligible: gate.eligible, reason: gate.reason, status: gate.status, nextTemplateId: config.templateId, messageType: config.messageType, destinationType: config.destinationType, schemaVersion: NURTURE_SCHEMA_VERSION };
}

function createMessage(input = {}) {
  const config = TRACK_CONFIG[input.track];
  if (!config) return null;
  return { nurtureId: input.nurtureId || null, leadId: input.leadId || '', track: input.track, templateId: input.templateId || config.templateId, messageType: input.messageType || config.messageType, status: input.status || NURTURE_STATUSES.QUEUED, scheduledAt: input.scheduledAt || null, sentAt: null, engagedAt: null, ctaType: input.ctaType || '', destinationType: input.destinationType || config.destinationType, source: 'ARI', schemaVersion: NURTURE_SCHEMA_VERSION };
}

function nurtureTouch(track, at = new Date().toISOString()) {
  return { source: 'ari_nurture', medium: 'email', campaign: String(track || '').toLowerCase(), landingPage: '', referrer: '', capturedAt: at };
}

function messageDedupeKey(message) { return `${message.leadId}:${message.track}:${message.templateId}`; }

function createNurtureRepository({ saveDecision, queueMessage, updateStatus, findByLead } = {}) {
  for (const fn of [saveDecision, queueMessage, updateStatus, findByLead]) if (typeof fn !== 'function') throw new TypeError('NurtureRepository requires saveDecision, queueMessage, updateStatus and findByLead adapters');
  return Object.freeze({ saveDecision, queueMessage: async (message) => queueMessage(message, messageDedupeKey(message)), updateStatus, findByLead });
}

function createEmailProvider({ sendTemplate = async () => ({ sent: false, reason: 'not_configured' }) } = {}) {
  return Object.freeze({ sendTemplate });
}

export { NURTURE_STATUSES, NURTURE_TRACKS, MESSAGE_TYPES, NURTURE_EVENTS, NURTURE_SCHEMA_VERSION, TRACK_PRIORITY, TRACK_CONFIG, TIMING_CONFIG, eligibility, chooseTrack, createNurtureDecision, createMessage, nurtureTouch, messageDedupeKey, createNurtureRepository, createEmailProvider };
