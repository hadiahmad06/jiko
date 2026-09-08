// src/services/ics.ts
//
// Minimal iCalendar reader: VEVENT -> obligation (kind event). Handles folded
// lines, DTSTART/DTEND with TZID or Z, all-day DATE values, SUMMARY escaping.
// No RRULE expansion (recurring events import their first occurrence only).
import { ObligationCreateT } from '../types/obligation/Obligation.js';

interface DtValue { value: string; tzid?: string | undefined; isDate: boolean }
interface VEvent { uid?: string; summary?: string; description?: string; dtstart?: DtValue; dtend?: DtValue; location?: string }

function unfold(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if ((raw.startsWith(' ') || raw.startsWith('\t')) && out.length) out[out.length - 1] += raw.slice(1);
    else out.push(raw);
  }
  return out;
}

function unescape(s: string): string {
  return s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

/** ICS local time in a TZID -> UTC Date. Uses Intl to find the zone's offset at that wall time. */
function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string | undefined): Date {
  const naive = Date.UTC(y, mo - 1, d, h, mi, s);
  if (!tz) return new Date(naive);
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false });
    const parts = Object.fromEntries(fmt.formatToParts(new Date(naive)).map(p => [p.type, p.value]));
    const asIfUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
    return new Date(naive - (asIfUtc - naive));
  } catch {
    return new Date(naive);
  }
}

function parseDt(v: DtValue): Date | null {
  const m = v.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0', z] = m;
  if (v.isDate) return new Date(Date.UTC(+y!, +mo! - 1, +d!));
  if (z) return new Date(Date.UTC(+y!, +mo! - 1, +d!, +h, +mi, +s));
  return zonedToUtc(+y!, +mo!, +d!, +h, +mi, +s, v.tzid);
}

export function parseIcs(text: string): VEvent[] {
  const events: VEvent[] = [];
  let cur: VEvent | null = null;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const left = line.slice(0, idx); const value = line.slice(idx + 1);
    const [name, ...params] = left.split(';');
    const p = Object.fromEntries(params.map(x => { const [k, v] = x.split('='); return [k!.toUpperCase(), v ?? '']; }));
    switch (name!.toUpperCase()) {
      case 'UID': cur.uid = value; break;
      case 'SUMMARY': cur.summary = unescape(value); break;
      case 'DESCRIPTION': cur.description = unescape(value); break;
      case 'LOCATION': cur.location = unescape(value); break;
      case 'DTSTART': cur.dtstart = { value, tzid: p.TZID, isDate: p.VALUE === 'DATE' }; break;
      case 'DTEND': cur.dtend = { value, tzid: p.TZID, isDate: p.VALUE === 'DATE' }; break;
    }
  }
  return events;
}

export interface IcsImportOptions { from?: Date; to?: Date; source?: string }

/** Events -> obligation create bodies, windowed. `external_ref` = UID for idempotent re-import. */
export function icsToObligations(text: string, opts: IcsImportOptions = {}): Array<ObligationCreateT & { external_ref: string }> {
  const from = opts.from ?? new Date(Date.now() - 24 * 3600_000);
  const to = opts.to ?? new Date(Date.now() + 30 * 86_400_000);
  const out: Array<ObligationCreateT & { external_ref: string }> = [];
  for (const ev of parseIcs(text)) {
    if (!ev.dtstart) continue;
    const start = parseDt(ev.dtstart);
    if (!start || start < from || start > to) continue;
    const end = ev.dtend ? parseDt(ev.dtend) : null;
    const isTask = /\b(due|deadline|submit|turn in|hand in)\b/i.test(ev.summary ?? '');
    out.push({
      kind: isTask ? 'task' : 'event',
      title: (ev.summary ?? 'untitled').slice(0, 200),
      ...(ev.description ? { description: ev.description.slice(0, 2000) } : {}),
      ...(isTask ? { due_at: start } : { start_at: start, ...(end ? { end_at: end } : {}), all_day: ev.dtstart.isDate }),
      source: opts.source ?? 'ics',
      external_ref: ev.uid ?? `${ev.summary}@${start.toISOString()}`,
    });
  }
  return out;
}
