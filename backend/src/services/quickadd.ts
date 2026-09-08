// src/services/quickadd.ts
//
// "OS midterm thu 2pm" -> { kind: 'task', title: 'OS midterm', due_at }.
// Deliberately small: weekday names, today/tomorrow/tonight, "in N hours/days",
// explicit times, "at"/"due"/"by". Anything it can't date returns null so the
// caller can ask instead of guessing.
import { ObligationCreateT } from '../types/obligation/Obligation.js';
import { localHHMM } from './triggers/time.js';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_RE = /\b(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(day|sday|nesday|rsday|urday)?\b/i;
const TIME_RE = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b|\b(noon|midnight)\b/i;
const REL_RE = /\bin\s+(\d+)\s*(min|mins|minutes|h|hr|hrs|hours?|d|days?|w|weeks?)\b/i;
const WORD_RE = /\b(today|tomorrow|tonight|tmrw)\b/i;

function tzOffsetMinutes(date: Date, timezone: string): number {
  // offset = local - utc, derived from the local HH:MM of the instant
  const [h, m] = localHHMM(date, timezone).split(':').map(Number);
  const localMin = h! * 60 + m!;
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes();
  let diff = localMin - utcMin;
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  return diff;
}

/** Build a UTC instant for a local date/time in a timezone. */
function localToUtc(y: number, mo: number, d: number, h: number, mi: number, timezone: string): Date {
  const guess = new Date(Date.UTC(y, mo, d, h, mi));
  const off = tzOffsetMinutes(guess, timezone);
  return new Date(guess.getTime() - off * 60_000);
}

export function parseQuickAdd(text: string, now = new Date(), timezone = 'UTC'): Omit<ObligationCreateT, 'source'> | null {
  let title = text.trim();
  let hour: number | null = null, minute = 0;
  let dayOffset: number | null = null;
  let explicitDate: Date | null = null;

  const time = title.match(TIME_RE);
  if (time) {
    if (time[6]) { hour = time[6].toLowerCase() === 'noon' ? 12 : 0; }
    else if (time[3]) { hour = Number(time[1]) % 12 + (time[3].toLowerCase() === 'pm' ? 12 : 0); minute = Number(time[2] ?? 0); }
    else { hour = Number(time[4]); minute = Number(time[5]); }
    title = title.replace(time[0], ' ');
  }

  const rel = title.match(REL_RE);
  if (rel) {
    const n = Number(rel[1]); const u = rel[2]!.toLowerCase();
    const ms = /^min/.test(u) ? n * 60_000 : /^h/.test(u) ? n * 3_600_000 : /^d/.test(u) ? n * 86_400_000 : n * 604_800_000;
    explicitDate = new Date(now.getTime() + ms);
    title = title.replace(rel[0], ' ');
  }

  const word = title.match(WORD_RE);
  if (word) {
    const w = word[1]!.toLowerCase();
    dayOffset = w === 'today' ? 0 : w === 'tonight' ? 0 : 1;
    if (w === 'tonight' && hour === null) { hour = 21; }
    title = title.replace(word[0], ' ');
  }

  const day = title.match(DAY_RE);
  if (day && dayOffset === null && !explicitDate) {
    const idx = DAYS.findIndex(d => d.startsWith(day[1]!.toLowerCase().slice(0, 3)));
    const localNow = localParts(now, timezone);
    let off = (idx - localNow.weekday + 7) % 7;
    if (off === 0 && (hour === null || hour * 60 + minute <= localNow.h * 60 + localNow.m)) off = 7;
    dayOffset = off;
    title = title.replace(day[0], ' ');
  }

  if (explicitDate === null && dayOffset === null && hour === null) return null;

  let due: Date;
  if (explicitDate) {
    due = explicitDate;
  } else {
    const p = localParts(now, timezone);
    const h = hour ?? 23, mi = hour === null ? 59 : minute;
    let off = dayOffset ?? 0;
    if (dayOffset === null && hour !== null && h * 60 + mi <= p.h * 60 + p.m) off = 1; // "at 3pm" after 3pm means tomorrow
    due = localToUtc(p.y, p.mo, p.d + off, h, mi, timezone);
  }

  title = title.replace(/\b(due|by|at|on|deadline)\b\s*$/i, '').replace(/^\s*(due|by|at|on)\b/i, '').replace(/\s{2,}/g, ' ').replace(/[,\-–:]+\s*$/, '').trim();
  if (!title) title = 'untitled';
  const isEvent = /\b(meeting|class|lecture|call|interview|appointment|exam|midterm|final)\b/i.test(title) && hour !== null;
  return isEvent
    ? { kind: 'event', title, start_at: due, end_at: new Date(due.getTime() + 60 * 60_000) }
    : { kind: 'task', title, due_at: due };
}

function localParts(date: Date, timezone: string): { y: number; mo: number; d: number; h: number; m: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false, weekday: 'long' });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
  const h = Number(parts.hour) % 24;
  return { y: Number(parts.year), mo: Number(parts.month) - 1, d: Number(parts.day), h, m: Number(parts.minute), weekday: DAYS.indexOf(String(parts.weekday).toLowerCase()) };
}
