import { NORMAL_PUBLISH_TIMES, NORMAL_BUFFER_TRANSFER, NORMAL_WEB_PUBLISH } from './social-channels.mjs';

const TZ = 'Asia/Tokyo';

export function ymdJst(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: TZ });
}

export function roundUp15(totalMinutes) {
  return Math.ceil(totalMinutes / 15) * 15;
}

export function hmToIso(ymd, hm) {
  return `${ymd}T${hm}:00+09:00`;
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
 * Bump publishAt to at least minLeadMinutes after now (15-min rounding).
 */
export function resolvePublishAt(publishAtIso, now, minLeadMinutes = 30) {
  if (!publishAtIso) return null;
  const target = new Date(publishAtIso);
  const minMs = now.getTime() + minLeadMinutes * 60_000;
  const minDate = new Date(minMs);
  if (target.getTime() >= minDate.getTime()) return publishAtIso;

  const rounded = roundUp15(minDate.getHours() * 60 + minDate.getMinutes());
  const bumped = addMinutesJst(
    new Date(`${ymdJst(minDate)}T00:00:00+09:00`),
    rounded
  );
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
