// src/services/integrations/gmailExtract.ts
//
// Which emails become obligations. Deliberately conservative: an email turns
// into something Jiko can nudge about only if its subject or snippet names a
// commitment (interview, deadline, exam, appointment...) AND a date can be read
// from it. Everything else is ignored. A missed email costs less than a nudge
// about a newsletter.
import { ObligationCreateT } from '../../types/obligation/Obligation.js';
import { localToUtc, parseQuickAdd } from '../quickadd.js';
import type { GmailMessage } from './google.js';

const SIGNAL = /\b(interview|deadline|due|exam|midterm|final|quiz|appointment|rsvp|submit|submission|application|assessment|reminder|meeting|call|scheduled|reservation|flight|check-?in|orientation|onboarding)\b/i;
const EVENTISH = /\b(interview|appointment|meeting|call|exam|midterm|final|quiz|flight|reservation|orientation)\b/i;
const SKIP_LABELS = new Set(['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_FORUMS', 'SPAM', 'TRASH', 'SENT', 'DRAFT']);
// Mail that duplicates an integration Jiko already reads directly.
const SKIP_FROM = /(calendar-notification@google\.com|@instructure\.com|@canvaslms\.com|noreply@google\.com)/i;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_RE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?/i;
const NUMERIC_RE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/;
const TIME_RE = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b|\b(noon|midnight)\b/i;

function localYear(date: Date, tz: string): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric' }).format(date));
}

/** A date in an email, read relative to when it was sent. Null when there is none. */
export function parseEmailDate(text: string, sent: Date, tz = 'UTC'): { at: Date; hasTime: boolean } | null {
  const time = text.match(TIME_RE);
  let hour: number | null = null, minute = 0;
  if (time) {
    if (time[6]) hour = time[6].toLowerCase() === 'noon' ? 12 : 0;
    else if (time[3]) { hour = (Number(time[1]) % 12) + (time[3].toLowerCase() === 'pm' ? 12 : 0); minute = Number(time[2] ?? 0); }
    else { hour = Number(time[4]); minute = Number(time[5]); }
    if (hour > 23 || minute > 59) hour = null;
  }

  let y: number | null = null, mo: number | null = null, d: number | null = null, explicitYear = false;
  const m = text.match(MONTH_RE);
  if (m) {
    mo = MONTHS.indexOf(m[1]!.toLowerCase().slice(0, 3)); d = Number(m[2]);
    if (m[3]) { y = Number(m[3]); explicitYear = true; }
  } else {
    const n = text.match(NUMERIC_RE);
    if (n) {
      mo = Number(n[1]) - 1; d = Number(n[2]);
      if (n[3]) { y = Number(n[3].length === 2 ? `20${n[3]}` : n[3]); explicitYear = true; }
    }
  }

  if (mo !== null && d !== null && mo >= 0 && mo < 12 && d >= 1 && d <= 31) {
    const year = y ?? localYear(sent, tz);
    let at = localToUtc(year, mo, d, hour ?? 23, hour === null ? 59 : minute, tz);
    // "Nov 3" in a message sent in December means next year
    if (!explicitYear && at.getTime() < sent.getTime() - 2 * 86_400_000) at = localToUtc(year + 1, mo, d, hour ?? 23, hour === null ? 59 : minute, tz);
    return { at, hasTime: hour !== null };
  }

  // weekday names, "tomorrow", "in 3 days", a bare time
  const q = parseQuickAdd(text, sent, tz);
  const at = q?.due_at ?? q?.start_at;
  return at ? { at: new Date(at), hasTime: hour !== null } : null;
}

function cleanSubject(s: string): string {
  let out = s.trim();
  while (/^(re|fwd?|fw)\s*:\s*/i.test(out)) out = out.replace(/^(re|fwd?|fw)\s*:\s*/i, '');
  return out.slice(0, 200) || '(no subject)';
}

function senderName(from: string): string {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
  return (m?.[1] ?? from).trim();
}

export function extractFromEmail(
  msg: GmailMessage,
  opts: { now: Date; timezone?: string; source: string; horizonDays?: number },
): (ObligationCreateT & { external_ref: string }) | null {
  if (msg.labelIds.some(l => SKIP_LABELS.has(l))) return null;
  if (SKIP_FROM.test(msg.from)) return null;
  const inSubject = SIGNAL.test(msg.subject);
  if (!inSubject && !SIGNAL.test(msg.snippet)) return null;

  const sent = new Date(msg.internalDate);
  const tz = opts.timezone ?? 'UTC';
  const found = parseEmailDate(msg.subject, sent, tz) ?? parseEmailDate(msg.snippet, sent, tz);
  if (!found) return null;

  const horizon = opts.now.getTime() + (opts.horizonDays ?? 60) * 86_400_000;
  if (found.at.getTime() < opts.now.getTime() - 3_600_000 || found.at.getTime() > horizon) return null;

  const title = cleanSubject(msg.subject);
  const description = `email from ${senderName(msg.from)}: ${msg.snippet}`.slice(0, 500);
  const isEvent = found.hasTime && EVENTISH.test(`${msg.subject} ${msg.snippet}`);
  return isEvent
    ? { kind: 'event', title, description, start_at: found.at, end_at: new Date(found.at.getTime() + 3_600_000), source: opts.source, external_ref: msg.id }
    : { kind: 'task', title, description, due_at: found.at, source: opts.source, external_ref: msg.id };
}
