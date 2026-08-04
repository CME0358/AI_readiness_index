import { NORMAL_PUBLISH_TIMES, NORMAL_BUFFER_TRANSFER, NORMAL_WEB_PUBLISH } from './social-channels.mjs';

const TZ = 'Asia/Tokyo';

export function ymdJst(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: TZ });
}

export function roundUp15(totalMinutes) {
  return Math.ceil(totalMinutes / 15) * 15;
}

/** JST wall-clock ISO with +09:00 offset (queue storage / logs) */
export function hmToIso(ymd, hm) {
  return `${ymd}T${hm}:00+09:00`;
}

/** Minutes since JST midnight — always uses Asia/Tokyo, never system TZ */
export function jstMinutesFromMidnight(date) {
  const hm = date.toLocaleTimeString('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

export function parseScheduleInstant(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid schedule instant: ${isoOrDate}`);
  }
  return d;
}

/** Buffer GraphQL dueAt — explicit UTC ISO 8601 */
export function toBufferDueAt(isoOrDate) {
  return parseScheduleInstant(isoOrDate).toISOString();
}

export function isScheduleInstantInFuture(isoOrDate, now = new Date(), minLeadMs = 0) {
  const t = parseScheduleInstant(isoOrDate).getTime();
  return t > now.getTime() + minLeadMs;
}

export function addMinutesJst(base, minutes) {
  const d = new Date(base.getTime() + minutes * 60_000);
  const ymd = d.toLocaleDateString('en-CA', { timeZone: TZ });
  const hm = d.toLocaleTimeString('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return { ymd, hm, iso: hmToIso(ymd, hm) };
}

/**
 * Bump publishAt to at least minLeadMinutes after now (15-min JST rounding).
 * Returns JST ISO string (+09:00) for queue storage.
 */
export function resolvePublishAt(publishAtIso, now, minLeadMinutes = 30) {
  if (!publishAtIso) return null;
  const target = parseScheduleInstant(publishAtIso);
  const minMs = now.getTime() + minLeadMinutes * 60_000;
  const minDate = new Date(minMs);
  if (target.getTime() >= minDate.getTime()) return publishAtIso;

  const ymd = ymdJst(minDate);
  const rounded = roundUp15(jstMinutesFromMidnight(minDate));
  const bumped = addMinutesJst(new Date(`${ymd}T00:00:00+09:00`), rounded);
  return bumped.iso;
}

/** Build channel publishAt map for a business day */
export function channelPublishTimesForDay(ymd, overrides = {}) {
  const out = {};
  for (const [ch, hm] of Object.entries(NORMAL_PUBLISH_TIMES)) {
    out[ch] = hmToIso(ymd, overrides[ch] || hm);
  }
  return out;
}

export function defaultArticleTimes(ymd) {
  return {
    articlePublishAt: hmToIso(ymd, NORMAL_WEB_PUBLISH),
    bufferTransferAt: hmToIso(ymd, NORMAL_BUFFER_TRANSFER),
    channels: channelPublishTimesForDay(ymd),
  };
}
