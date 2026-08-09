/** RMVU-05F — fixture / test item detection and tagging. */

export const ITEM_ORIGIN = {
  LIVE: 'live',
  FIXTURE: 'fixture',
  BACKFILL: 'backfill',
};

export const ITEM_ENVIRONMENT = {
  PRODUCTION: 'production',
  TEST: 'test',
};

const EXAMPLE_URL_PATTERNS = [
  /\/example[-/]/i,
  /example-[a-z0-9-]+\/?$/i,
  /\/example\//i,
];

export function isExampleUrl(url = '') {
  return EXAMPLE_URL_PATTERNS.some((re) => re.test(url));
}

export function isFixtureItem(item = {}) {
  if (!item) return false;
  if (item.origin === ITEM_ORIGIN.FIXTURE || item.origin === ITEM_ORIGIN.BACKFILL) return true;
  if (item.environment === ITEM_ENVIRONMENT.TEST) return true;
  if (String(item.item_id || '').startsWith('backfill-')) return true;
  if (isExampleUrl(item.url)) return true;
  return false;
}

export function isFixtureEvent(event = {}) {
  if (!event) return false;
  if (event.origin === ITEM_ORIGIN.FIXTURE || event.origin === ITEM_ORIGIN.BACKFILL) return true;
  if (event.environment === ITEM_ENVIRONMENT.TEST) return true;
  if (isFixtureItem(event.primary_source)) return true;
  if (isExampleUrl(event.url)) return true;
  return false;
}

export function isFixtureQueueEntry(entry = {}, eventsById = new Map()) {
  if (!entry) return false;
  if (entry.origin === ITEM_ORIGIN.FIXTURE || entry.origin === ITEM_ORIGIN.BACKFILL) return true;
  if (entry.environment === ITEM_ENVIRONMENT.TEST) return true;
  const ev = eventsById.get(entry.event_id);
  if (ev && isFixtureEvent(ev)) return true;
  if (isExampleUrl(entry.source_url || entry.url)) return true;
  return false;
}

export function tagLiveItem(item) {
  return {
    ...item,
    origin: ITEM_ORIGIN.LIVE,
    environment: ITEM_ENVIRONMENT.PRODUCTION,
  };
}

export function tagFixtureItems(items = []) {
  return items.map((item) => ({
    ...item,
    origin: item.origin || ITEM_ORIGIN.FIXTURE,
    environment: item.environment || ITEM_ENVIRONMENT.TEST,
  }));
}

export function productionEventIds(events = []) {
  return new Set(events.filter((e) => !isFixtureEvent(e)).map((e) => e.event_id));
}

export function productionEvents(events = []) {
  return events.filter((e) => !isFixtureEvent(e));
}
