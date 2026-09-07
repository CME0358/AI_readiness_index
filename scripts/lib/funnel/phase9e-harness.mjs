import { createEventPayload } from './events.mjs';
import { createConversion, mapEventToConversion } from './conversions.mjs';

/**
 * Deterministic, in-process Phase 9 journey harness.
 * It emits payloads only; it never calls Airtable, Stripe, or a network API.
 */
export function simulatePhase9Journey({
  sourceSurface = 'homepage',
  insightSlug = '',
  editorialIntent = '',
  nextStep = 'REPORT',
  verifiedPurchase = false,
  qualificationBand = '',
} = {}) {
  const source = sourceSurface === 'insight' ? 'insight' : sourceSurface;
  const attribution = {
    source: 'test_source',
    medium: 'test_medium',
    campaign: 'phase9e_fixture',
    landingPage: source === 'insight' ? `/insights/${insightSlug}/` : '/',
    insightSlug,
    editorialIntent,
    sourceSurface: source,
    ctaId: source === 'insight' ? `insight_${insightSlug}_check_1` : 'homepage_check_submit',
    ctaType: 'CHECK',
  };
  const events = [];
  const conversions = [];
  const emit = (event, input = {}) => {
    const payload = createEventPayload(event, { ...attribution, ...input });
    if (payload) events.push(payload);
    return payload;
  };

  emit('landing_view');
  if (source === 'insight') emit('cta_impression');
  emit('check_impression');
  emit('check_start');
  emit('check_result', { resultCategory: 'BASIC_SIGNAL_FOUND' });

  if (nextStep === 'LOCAL') emit('cta_click', { ctaId: `${source}_check_local`, ctaType: 'LOCAL' });
  else if (nextStep === 'LEARN') emit('cta_click', { ctaId: `${source}_check_learn`, ctaType: 'LEARN' });
  else {
    emit('cta_click', { ctaId: `${source}_check_report`, ctaType: 'REPORT' });
    emit('report_proof_impression', { sourceSurface: 'report' });
    emit('report_checkout_start', { sourceSurface: 'report' });
    if (verifiedPurchase) {
      const conversionType = mapEventToConversion('purchase_verified', { verified: true, product_id: 'company_report_bundle' });
      conversions.push(createConversion({
        conversionType,
        externalReference: 'cs_phase9e_fixture',
        sourcePage: '/report/',
        insightSlug,
        editorialIntent,
        firstTouch: attribution,
        lastTouch: { ...attribution, ctaType: 'REPORT' },
      }));
      emit('purchase_verified', { sourceSurface: 'report', value: '29800', currency: 'JPY' });
    }
    if (qualificationBand) {
      emit('partner_qualification_complete', { sourceSurface: 'report', qualificationBand, recommendedAction: ['HIGH', 'MEDIUM'].includes(qualificationBand) ? 'CONSULT' : 'LEARN' });
      if (['HIGH', 'MEDIUM'].includes(qualificationBand)) emit('partner_consult_cta_click', { sourceSurface: 'report' });
    }
  }
  return { events, conversions, attribution };
}
