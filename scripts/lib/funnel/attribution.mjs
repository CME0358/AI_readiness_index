const ATTRIBUTION_KEYS = Object.freeze([
  'source',
  'medium',
  'campaign',
  'content',
  'term',
  'landingPage',
  'referrer',
]);

const UTM_TO_FIELD = Object.freeze({
  utm_source: 'source',
  utm_medium: 'medium',
  utm_campaign: 'campaign',
  utm_content: 'content',
  utm_term: 'term',
});

function emptyAttribution() {
  return { source: '', medium: '', campaign: '', content: '', term: '', landingPage: '', referrer: '', capturedAt: '' };
}

function parseAttribution(input, { landingPage = '', referrer = '', now = new Date().toISOString() } = {}) {
  const params = input instanceof URLSearchParams
    ? input
    : new URLSearchParams(typeof input === 'string' ? input.replace(/^\?/, '') : '');
  const result = emptyAttribution();
  for (const [key, field] of Object.entries(UTM_TO_FIELD)) result[field] = (params.get(key) || '').slice(0, 200);
  result.landingPage = String(landingPage || '').slice(0, 500);
  result.referrer = String(referrer || '').slice(0, 500);
  result.capturedAt = now;
  return result;
}

function hasSignal(attribution) {
  return ATTRIBUTION_KEYS.some((key) => Boolean(attribution?.[key]));
}

function createAttributionStore(storage, key = 'ari_attribution_v1') {
  const read = () => {
    try { return JSON.parse(storage?.getItem(key) || '{}'); } catch { return {}; }
  };
  const write = (value) => {
    try { storage?.setItem(key, JSON.stringify(value)); } catch { /* storage is optional */ }
  };
  return {
    getAttribution: () => {
      const current = read();
      return {
        firstTouch: { ...emptyAttribution(), ...(current.firstTouch || {}) },
        lastTouch: { ...emptyAttribution(), ...(current.lastTouch || {}) },
      };
    },
    setFirstTouch: (value) => {
      const current = read();
      if (!hasSignal(current.firstTouch) && hasSignal(value)) write({ ...current, firstTouch: value });
      return { ...emptyAttribution(), ...read() }.firstTouch || null;
    },
    setLastTouch: (value) => {
      const current = read();
      if (hasSignal(value)) write({ ...current, lastTouch: value });
      return { ...emptyAttribution(), ...read() }.lastTouch || null;
    },
    clearAttribution: () => {
      try { storage?.removeItem(key); } catch { /* storage is optional */ }
    },
  };
}

export { ATTRIBUTION_KEYS, emptyAttribution, parseAttribution, createAttributionStore };
