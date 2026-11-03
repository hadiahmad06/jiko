// src/services/integrations/canvas.ts
//
// Canvas over its REST API with a personal access token, rather than the
// calendar feed, because the planner knows what the feed does not: whether the
// assignment was already submitted. A submitted (or excused, or marked-done)
// assignment becomes a completed obligation, so Jiko stops nudging about it.
import { ObligationCreateT } from '../../types/obligation/Obligation.js';
import { isPrivateHost } from '../calendars.js';
import { fetchJson } from './http.js';

/** "canvas.school.edu", "https://school.instructure.com/courses/1" -> "https://school.instructure.com" */
export function normalizeCanvasUrl(raw: string): { ok: true; url: string } | { ok: false; reason: string } {
  let candidate = raw.trim();
  if (!/^[a-z]+:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  let u: URL;
  try { u = new URL(candidate); } catch { return { ok: false, reason: 'That is not a Canvas address.' }; }
  if (u.protocol !== 'https:') return { ok: false, reason: 'Canvas addresses must be https.' };
  if (!u.hostname.includes('.')) return { ok: false, reason: 'That is not a Canvas address.' };
  if (isPrivateHost(u.hostname) && process.env.JIKO_ICS_ALLOW_PRIVATE !== 'true') return { ok: false, reason: 'That host is not reachable from the server.' };
  return { ok: true, url: u.origin };
}

const auth = (token: string): RequestInit => ({ headers: { authorization: `Bearer ${token}` } });

export async function verifyCanvas(base: string, token: string): Promise<{ id: number; name: string }> {
  const { body } = await fetchJson<{ id: number; name: string; short_name?: string }>(`${base}/api/v1/users/self`, auth(token), 'Canvas sign-in');
  return { id: body.id, name: body.short_name || body.name };
}

export interface PlannerItem {
  plannable_type: string;
  plannable_id: number | string;
  plannable_date?: string | null;
  context_name?: string | null;
  plannable?: { title?: string; name?: string; due_at?: string | null; todo_date?: string | null; start_at?: string | null; end_at?: string | null } | null;
  submissions?: false | { submitted?: boolean; excused?: boolean; graded?: boolean; missing?: boolean } | null;
  planner_override?: { marked_complete?: boolean; dismissed?: boolean } | null;
}

/** The user's planner between two dates, following Link: rel="next" for up to 10 pages. */
export async function fetchPlannerItems(base: string, token: string, from: Date, to: Date): Promise<PlannerItem[]> {
  const first = new URL(`${base}/api/v1/planner/items`);
  first.searchParams.set('start_date', from.toISOString());
  first.searchParams.set('end_date', to.toISOString());
  first.searchParams.set('per_page', '100');
  let next: string | null = first.toString();
  const out: PlannerItem[] = [];
  for (let page = 0; next && page < 10; page++) {
    const res: { body: PlannerItem[]; headers: Headers } = await fetchJson<PlannerItem[]>(next, auth(token), 'Canvas planner');
    out.push(...(Array.isArray(res.body) ? res.body : []));
    next = nextLink(res.headers.get('link'));
    // only ever follow pages on the same Canvas host
    if (next && new URL(next).origin !== new URL(base).origin) next = null;
  }
  return out;
}

export function nextLink(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(',')) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="?next"?/);
    if (m) return m[1]!;
  }
  return null;
}

const SKIP_TYPES = new Set(['announcement', 'wiki_page']);

export function mapPlannerItems(items: PlannerItem[], source: string): Array<ObligationCreateT & { external_ref: string; completed: boolean }> {
  const out: Array<ObligationCreateT & { external_ref: string; completed: boolean }> = [];
  for (const it of items) {
    if (SKIP_TYPES.has(it.plannable_type)) continue;
    if (it.planner_override?.dismissed) continue;
    const p = it.plannable ?? {};
    const title = (p.title || p.name || 'Canvas item').trim().slice(0, 200);
    const course = it.context_name?.trim();
    const subs = it.submissions || null;
    const completed = Boolean(subs?.submitted || subs?.excused || it.planner_override?.marked_complete);
    const external_ref = `${it.plannable_type}:${it.plannable_id}`;
    if (it.plannable_type === 'calendar_event') {
      const start = p.start_at ?? it.plannable_date;
      if (!start) continue;
      out.push({ kind: 'event', title, ...(course ? { description: course } : {}), start_at: new Date(start), ...(p.end_at ? { end_at: new Date(p.end_at) } : {}), source, external_ref, completed });
      continue;
    }
    const due = p.due_at ?? p.todo_date ?? it.plannable_date;
    if (!due) continue;
    out.push({ kind: 'task', title, ...(course ? { description: course } : {}), due_at: new Date(due), source, external_ref, completed });
  }
  return out;
}
