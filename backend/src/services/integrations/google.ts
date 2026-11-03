// src/services/integrations/google.ts
//
// "Connect Google": one OAuth consent for Gmail (read) and Calendar (read).
// The server is a confidential client; the refresh token is sealed and stored,
// access tokens are refreshed on demand.
//
// While the Google Cloud app is in "Testing", only listed test users can sign
// in and refresh tokens die after 7 days. A dead token surfaces as
// IntegrationAuthError and the integration is marked needs_reauth.
import { ObligationCreateT } from '../../types/obligation/Obligation.js';
import { tokenKeyConfigured } from '../../lib/secretBox.js';
import { fetchJson, IntegrationAuthError, IntegrationHttpError } from './http.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const CAL = 'https://www.googleapis.com/calendar/v3';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

export const SCOPE_GMAIL = 'https://www.googleapis.com/auth/gmail.readonly';
export const SCOPE_CALENDAR = 'https://www.googleapis.com/auth/calendar.readonly';
export const GOOGLE_SCOPES = ['openid', 'email', SCOPE_GMAIL, SCOPE_CALENDAR];

export function publicUrl(): string | null {
  const u = process.env.JIKO_PUBLIC_URL;
  return u ? u.replace(/\/+$/, '') : null;
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && publicUrl() && tokenKeyConfigured());
}

export function redirectUri(): string {
  return `${publicUrl()}/integrations/google/callback`;
}

export function authUrl(state: string): string {
  const u = new URL(AUTH_URL);
  u.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
  u.searchParams.set('redirect_uri', redirectUri());
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
  // offline + consent: always get a refresh token, even on a reconnect
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('prompt', 'consent');
  u.searchParams.set('include_granted_scopes', 'true');
  u.searchParams.set('state', state);
  return u.toString();
}

interface TokenResponse { access_token: string; expires_in: number; refresh_token?: string; scope?: string; id_token?: string }

function form(params: Record<string, string>): RequestInit {
  return { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() };
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const { body } = await fetchJson<TokenResponse>(TOKEN_URL, form({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri(),
    grant_type: 'authorization_code',
  }), 'Google token exchange');
  return body;
}

export async function refreshAccessToken(refresh_token: string): Promise<{ access_token: string; expires_at: Date }> {
  try {
    const { body } = await fetchJson<TokenResponse>(TOKEN_URL, form({
      refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }), 'Google token refresh');
    return { access_token: body.access_token, expires_at: new Date(Date.now() + (body.expires_in - 60) * 1000) };
  } catch (err) {
    // invalid_grant = revoked, expired (7-day testing limit) or password changed
    if (err instanceof IntegrationHttpError && err.status === 400 && /invalid_grant/.test(err.message)) {
      throw new IntegrationAuthError('Google access expired or was revoked. Reconnect Google.');
    }
    throw err;
  }
}

export async function revokeToken(token: string): Promise<void> {
  try { await fetchJson(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: 'POST' }, 'Google revoke'); } catch { /* best effort */ }
}

/** The id_token came straight from Google's token endpoint over TLS; reading its payload is enough. */
export function emailFromIdToken(id_token: string | undefined): string | null {
  if (!id_token) return null;
  try {
    const payload = JSON.parse(Buffer.from(id_token.split('.')[1]!, 'base64url').toString('utf8')) as { email?: string };
    return payload.email ?? null;
  } catch { return null; }
}

const auth = (token: string): RequestInit => ({ headers: { authorization: `Bearer ${token}` } });

// ---------------------------------------------------------------- calendar

interface GCalendar { id: string; summary?: string; selected?: boolean; primary?: boolean; accessRole?: string }
export interface GEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ self?: boolean; responseStatus?: string }>;
  eventType?: string;
}

export async function fetchCalendarEvents(token: string, from: Date, to: Date): Promise<Array<{ calendarId: string; calendarName: string; event: GEvent }>> {
  const { body: list } = await fetchJson<{ items?: GCalendar[] }>(`${CAL}/users/me/calendarList?minAccessRole=reader&maxResults=50`, auth(token), 'Google calendar list');
  const calendars = (list.items ?? []).filter(c => c.primary || c.selected !== false).slice(0, 10);
  const out: Array<{ calendarId: string; calendarName: string; event: GEvent }> = [];
  for (const cal of calendars) {
    const u = new URL(`${CAL}/calendars/${encodeURIComponent(cal.id)}/events`);
    u.searchParams.set('timeMin', from.toISOString());
    u.searchParams.set('timeMax', to.toISOString());
    u.searchParams.set('singleEvents', 'true');
    u.searchParams.set('orderBy', 'startTime');
    u.searchParams.set('maxResults', '250');
    const { body } = await fetchJson<{ items?: GEvent[] }>(u.toString(), auth(token), 'Google calendar events');
    for (const event of body.items ?? []) out.push({ calendarId: cal.id, calendarName: cal.summary ?? 'Calendar', event });
  }
  return out;
}

type ExternalItem = ObligationCreateT & { external_ref: string };

/** Calendar events -> event obligations. Skips cancelled, declined, and working-location/out-of-office blocks. */
export function mapCalendarEvents(items: Array<{ calendarId: string; calendarName: string; event: GEvent }>, source: string): ExternalItem[] {
  const out: ExternalItem[] = [];
  for (const { calendarId, calendarName, event: e } of items) {
    if (e.status === 'cancelled') continue;
    if (e.eventType && e.eventType !== 'default') continue;
    if (e.attendees?.some(a => a.self && a.responseStatus === 'declined')) continue;
    const allDay = Boolean(e.start?.date && !e.start?.dateTime);
    const start = e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00Z` : null);
    if (!start) continue;
    const end = e.end?.dateTime ?? (e.end?.date ? `${e.end.date}T00:00:00Z` : null);
    const desc = [calendarName !== calendarId ? calendarName : null, e.location].filter(Boolean).join(' · ');
    out.push({
      kind: 'event',
      title: (e.summary?.trim() || '(no title)').slice(0, 200),
      ...(desc ? { description: desc.slice(0, 500) } : {}),
      start_at: new Date(start),
      ...(end ? { end_at: new Date(end) } : {}),
      all_day: allDay,
      source,
      external_ref: `${calendarId}:${e.id}`,
    });
  }
  return out;
}

// ---------------------------------------------------------------- gmail

export interface GmailMessage {
  id: string;
  internalDate: number;
  labelIds: string[];
  subject: string;
  from: string;
  snippet: string;
}

/**
 * Recent inbox mail, metadata only: subject, sender, Gmail's snippet. Bodies are
 * never fetched or stored. Promotions/social/forums are excluded in the query.
 */
export async function fetchRecentMail(token: string, afterEpochSeconds: number, max = 50): Promise<GmailMessage[]> {
  const q = `in:inbox after:${Math.floor(afterEpochSeconds)} -category:promotions -category:social -category:forums`;
  const u = new URL(`${GMAIL}/messages`);
  u.searchParams.set('q', q);
  u.searchParams.set('maxResults', String(max));
  const { body } = await fetchJson<{ messages?: Array<{ id: string }> }>(u.toString(), auth(token), 'Gmail list');
  const out: GmailMessage[] = [];
  for (const { id } of body.messages ?? []) {
    const m = new URL(`${GMAIL}/messages/${id}`);
    m.searchParams.set('format', 'metadata');
    for (const h of ['Subject', 'From']) m.searchParams.append('metadataHeaders', h);
    const { body: msg } = await fetchJson<{ id: string; internalDate: string; labelIds?: string[]; snippet?: string; payload?: { headers?: Array<{ name: string; value: string }> } }>(m.toString(), auth(token), 'Gmail message');
    const header = (n: string) => msg.payload?.headers?.find(h => h.name.toLowerCase() === n.toLowerCase())?.value ?? '';
    out.push({ id: msg.id, internalDate: Number(msg.internalDate), labelIds: msg.labelIds ?? [], subject: header('Subject'), from: header('From'), snippet: decodeEntities(msg.snippet ?? '') });
  }
  return out;
}

function decodeEntities(s: string): string {
  return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
