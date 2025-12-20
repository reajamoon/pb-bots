function parseUtcOffsetMinutes(timeZone) {
  if (!timeZone) return null;
  const str = String(timeZone).trim().toUpperCase();

  // Accept UTC offsets like: UTC+5, UTC-08, UTC+05:00, +5, -8, +05:30
  const m = str.match(/^(?:UTC)?\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const hours = Number(m[2]);
  const minutes = m[3] ? Number(m[3]) : 0;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 14) return null;
  if (minutes < 0 || minutes >= 60) return null;
  return sign * (hours * 60 + minutes);
}

function getDatePartsInTimeZone(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const year = Number(parts.find(p => p.type === 'year')?.value);
  const month = Number(parts.find(p => p.type === 'month')?.value);
  const day = Number(parts.find(p => p.type === 'day')?.value);
  return { year, month, day };
}

function getTimeZoneOffsetMinutes(timeZone, date) {
  // Node 20 supports timeZoneName: 'shortOffset' (e.g., GMT-05:00). Fall back to 'short'.
  const tryStyles = ['shortOffset', 'short'];
  for (const timeZoneName of tryStyles) {
    try {
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName,
        hour: '2-digit',
        minute: '2-digit',
      });
      const parts = dtf.formatToParts(date);
      const tzName = parts.find(p => p.type === 'timeZoneName')?.value || '';
      const m = tzName.match(/GMT\s*([+-])\s*(\d{1,2})(?::(\d{2}))?/i);
      if (!m) return 0;
      const sign = m[1] === '-' ? -1 : 1;
      const hours = Number(m[2]);
      const minutes = m[3] ? Number(m[3]) : 0;
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
      return sign * (hours * 60 + minutes);
    } catch {
      // try next style
    }
  }
  return 0;
}

function getStartOfTodayUtc({ timeZone, now = new Date() } = {}) {
  const tz = timeZone || 'UTC';

  const offsetMinutes = parseUtcOffsetMinutes(tz);
  if (offsetMinutes !== null) {
    const localNowMs = now.getTime() + offsetMinutes * 60000;
    const localNow = new Date(localNowMs);
    const year = localNow.getUTCFullYear();
    const month = localNow.getUTCMonth();
    const day = localNow.getUTCDate();
    const localMidnightMs = Date.UTC(year, month, day, 0, 0, 0);
    return new Date(localMidnightMs - offsetMinutes * 60000);
  }

  // IANA zone: compute the UTC instant that corresponds to midnight "today" in that zone.
  const { year, month, day } = getDatePartsInTimeZone(now, tz);
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);

  let offset1 = getTimeZoneOffsetMinutes(tz, new Date(utcGuess));
  let utc = utcGuess - offset1 * 60000;

  // One refinement pass to handle DST transitions around midnight.
  const offset2 = getTimeZoneOffsetMinutes(tz, new Date(utc));
  if (offset2 !== offset1) {
    utc = utcGuess - offset2 * 60000;
  }

  return new Date(utc);
}

export {
  getStartOfTodayUtc,
  parseUtcOffsetMinutes,
  getTimeZoneOffsetMinutes,
};
