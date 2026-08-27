import { SEGMENTS } from './segments.mjs';

const ROUTE_ACTIONS = Object.freeze({ LOCAL: 'LOCAL', REPORT: 'REPORT', LEARN: 'LEARN' });
const DESTINATION_TYPES = Object.freeze({ LOCALGEO: 'LOCALGEO', REPORT: 'REPORT', PARTNER: 'PARTNER', LEARN: 'LEARN' });
const CONFIDENCE_BANDS = Object.freeze({ HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' });
const ROUTING_VERSION = '1';

function confidenceBand(value) {
  const confidence = Number(value) || 0;
  if (confidence >= 0.8) return CONFIDENCE_BANDS.HIGH;
  if (confidence >= 0.6) return CONFIDENCE_BANDS.MEDIUM;
  return CONFIDENCE_BANDS.LOW;
}

function localGeoDestination() {
  const url = new URL('https://localgeo.coaretail.com/');
  url.searchParams.set('utm_source', 'ari_preview');
  url.searchParams.set('utm_medium', 'outbound');
  url.searchParams.set('utm_campaign', 'direct_buyer');
  url.searchParams.set('utm_content', 'lead_routing');
  return url.toString();
}

function resolveLeadRoute(classification = {}) {
  const confidence = Number(classification.confidence) || 0;
  const band = confidenceBand(confidence);
  const neutral = {
    segment: SEGMENTS.UNKNOWN,
    action: ROUTE_ACTIONS.LEARN,
    destination: '/framework/',
    destinationType: DESTINATION_TYPES.LEARN,
    reason: 'insufficient_confidence',
    confidence,
    confidenceBand: band,
    partnerType: classification.partnerType || 'UNKNOWN',
    directBuyerType: classification.directBuyerType || 'UNKNOWN',
    requiresUserAction: true,
    version: ROUTING_VERSION,
  };

  if (band === CONFIDENCE_BANDS.LOW) return neutral;
  if (classification.segment === SEGMENTS.DIRECT_BUYER) {
    return { ...neutral, segment: SEGMENTS.DIRECT_BUYER, action: ROUTE_ACTIONS.LOCAL, destination: localGeoDestination(), destinationType: DESTINATION_TYPES.LOCALGEO, reason: 'classified_direct_buyer' };
  }
  if (classification.segment === SEGMENTS.AGENT_PARTNER) {
    return { ...neutral, segment: SEGMENTS.AGENT_PARTNER, action: ROUTE_ACTIONS.REPORT, destination: '/report/', destinationType: DESTINATION_TYPES.REPORT, reason: 'classified_agent_partner' };
  }
  return neutral;
}

export { ROUTE_ACTIONS, DESTINATION_TYPES, CONFIDENCE_BANDS, ROUTING_VERSION, confidenceBand, localGeoDestination, resolveLeadRoute };
