const TZ = 'Asia/Tokyo';

export function toJstDateString(date) {
  return date.toLocaleDateString('en-CA', { timeZone: TZ });
}

export function isWeekday(date) {
  const wd = new Date(
    date.toLocaleString('en-US', { timeZone: TZ })
  ).getDay();
  return wd >= 1 && wd <= 5;
}

/** @param {string} startYmd YYYY-MM-DD */
export function businessDaysFrom(startYmd, count) {
  const [y, m, d] = startYmd.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d, 1, 0, 0));
  const out = [];
  while (out.length < count) {
    if (isWeekday(cur)) out.push(toJstDateString(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export function isoAtJst(ymd, hm = '10:00') {
  return `${ymd}T${hm}:00+09:00`;
}

/** Next weekday on or after the day after `ymd` (unlock day → publish day). */
export function nextPublishDayAfterUnlock(unlockYmd) {
  const [y, m, d] = unlockYmd.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d, 1, 0, 0));
  cur.setUTCDate(cur.getUTCDate() + 1);
  while (!isWeekday(cur)) {
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return toJstDateString(cur);
}

/** Previous weekday YMD before startYmd. */
export function previousBusinessDay(startYmd) {
  const [y, m, d] = startYmd.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d, 1, 0, 0));
  cur.setUTCDate(cur.getUTCDate() - 1);
  while (!isWeekday(cur)) {
    cur.setUTCDate(cur.getUTCDate() - 1);
  }
  return toJstDateString(cur);
}

export function articleTimesForPublishDay(publishYmd) {
  return {
    web: isoAtJst(publishYmd, '10:00'),
    bufferTransfer: isoAtJst(publishYmd, '10:30'),
    linkedin: isoAtJst(publishYmd, '11:30'),
    facebook: isoAtJst(publishYmd, '11:45'),
    x: isoAtJst(publishYmd, '12:00'),
  };
}

export function charCountNoSpace(text) {
  return String(text || '').replace(/\s/g, '').length;
}
