// src/services/triggers/time.ts
// Timezone helpers that don't need a library.

/** "HH:MM" local time for an instant in a timezone. */
export function localHHMM(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
    const h = parts.find(p => p.type === 'hour')?.value ?? '00';
    const m = parts.find(p => p.type === 'minute')?.value ?? '00';
    return `${h === '24' ? '00' : h}:${m}`;
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

export function localWeekday(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long' }).format(date).toLowerCase();
  } catch {
    return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getUTCDay()]!;
  }
}

/** True if hhmm is inside [start, end], handling ranges that wrap midnight. */
export function inRange(hhmm: string, start: string, end: string): boolean {
  if (start <= end) return hhmm >= start && hhmm <= end;
  return hhmm >= start || hhmm <= end;
}

/** Start of the local calendar day containing `date`, as a UTC instant. */
export function startOfLocalDay(date: Date, timezone: string): Date {
  const hhmm = localHHMM(date, timezone);
  const [h, m] = hhmm.split(':').map(Number);
  const secs = date.getUTCSeconds() + date.getUTCMilliseconds() / 1000;
  return new Date(date.getTime() - ((h! * 60 + m!) * 60 + secs) * 1000);
}

export function humanizeDelta(from: Date, to: Date): string {
  const ms = to.getTime() - from.getTime();
  const abs = Math.abs(ms);
  const past = ms < 0;
  const mins = Math.round(abs / 60_000);
  let s: string;
  if (mins < 1) s = 'now';
  else if (mins < 60) s = `${mins} min`;
  else if (mins < 60 * 24) { const h = Math.round(mins / 60); s = `${h} hour${h === 1 ? '' : 's'}`; }
  else { const d = Math.round(mins / (60 * 24)); s = `${d} day${d === 1 ? '' : 's'}`; }
  if (s === 'now') return s;
  return past ? `${s} ago` : `in ${s}`;
}
