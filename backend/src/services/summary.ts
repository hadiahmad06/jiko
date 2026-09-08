// src/services/summary.ts
// "3h focused today, 40 min socials. better than tuesday."
import UsageRepository, { localDay } from './repositories/UsageRepository.js';
import ObligationRepository from './repositories/ObligationRepository.js';
import PreferencesRepository from './repositories/PreferencesRepository.js';
import { UsageSummary } from '../types/usage/Usage.js';

export async function buildDailySummary(user_id: string, daysAgo = 0, now = new Date()): Promise<UsageSummary> {
  const prefs = await PreferencesRepository.get(user_id);
  const day = localDay(new Date(now.getTime() - daysAgo * 86_400_000), prefs.timezone);
  const rows = await UsageRepository.forDay(user_id, day);
  const by_label: UsageSummary['by_label'] = { distracting: 0, work: 0, neutral: 0, unlabeled: 0 };
  const perApp = new Map<string, { bundle_id: string; app_name: string | null; label: UsageSummary['top_apps'][number]['label']; seconds: number; opens: number }>();
  let total = 0;
  for (const r of rows) {
    total += r.seconds;
    by_label[r.label ?? 'unlabeled'] += r.seconds;
    const cur = perApp.get(r.bundle_id) ?? { bundle_id: r.bundle_id, app_name: r.app_name, label: r.label, seconds: 0, opens: 0 };
    cur.seconds += r.seconds; cur.opens += r.opens;
    perApp.set(r.bundle_id, cur);
  }
  const top_apps = [...perApp.values()].sort((a, b) => b.seconds - a.seconds).slice(0, 8);
  const focus_minutes = await UsageRepository.focusMinutesForDay(user_id, day, prefs.timezone);
  const obligations_due_soon = await ObligationRepository.countDueWithin(user_id, 48);
  return { day, timezone: prefs.timezone, total_seconds: total, by_label, top_apps, focus_minutes, obligations_due_soon };
}

function fmtMin(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/** One or two sentences. Tone scales with strictness. No graphs, no guilt trip. */
export function formatDailySummary(s: UsageSummary, strictness = 0.5): string {
  const parts: string[] = [];
  if (s.focus_minutes > 0) parts.push(`${fmtMin(s.focus_minutes * 60)} focused`);
  if (s.by_label.distracting > 0) parts.push(`${fmtMin(s.by_label.distracting)} on distracting apps`);
  if (s.by_label.work > 0) parts.push(`${fmtMin(s.by_label.work)} on work apps`);
  if (parts.length === 0 && s.total_seconds > 0) parts.push(`${fmtMin(s.total_seconds)} of screen time`);
  if (parts.length === 0) return 'quiet day. nothing logged.';
  let line = parts.join(', ') + '.';
  const top = s.top_apps[0];
  if (top && top.label === 'distracting' && top.seconds > 1800) {
    line += strictness > 0.7 ? ` ${top.app_name ?? top.bundle_id} ate ${fmtMin(top.seconds)}. you know that's too much.` : ` most of it was ${top.app_name ?? top.bundle_id}.`;
  }
  if (s.obligations_due_soon > 0) {
    line += ` ${s.obligations_due_soon} thing${s.obligations_due_soon === 1 ? '' : 's'} due in the next two days.`;
  }
  return line;
}
