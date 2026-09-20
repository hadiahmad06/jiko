// src/services/messaging/budget.ts
//
// The interrupt budget the user set is a ceiling, not a target. Jiko spends
// less of it on days when the nudges are not landing — ignored, or answered
// with "ok" and nothing changing — and spends the whole thing when something
// is actually due. It never goes above what the user asked for.
import { query } from '../../db/psqlClient.js';
import ObligationRepository from '../repositories/ObligationRepository.js';

export interface BudgetSignals {
  /** Unsolicited nudges sent in the recent window. */
  nudges: number;
  /** Of those, how many got no reply at all. */
  ignored: number;
  /** Replies that were a bare acknowledgement ("ok", "k", "yeah"). */
  acks: number;
  /** Open obligations due in the next 24 hours. */
  due_soon: number;
}

export interface AdaptedBudget {
  budget: number;          // what the user set
  effective: number;       // what Jiko will actually spend today
  reason: 'as_set' | 'deadline' | 'mostly_ignored' | 'mostly_acked';
}

export const WINDOW_DAYS = Number(process.env.JIKO_BUDGET_WINDOW_DAYS || 3);

/**
 * Pure decision, so the rule is testable and arguable.
 *
 * - Something due in 24 hours: spend the full budget, whatever last week
 *   looked like. A deadline is the one time interrupting is the job.
 * - Most nudges ignored: halve it (rounded up). Being ignored twice as often
 *   is not an argument for talking twice as much.
 * - Mostly "ok" and nothing changed: one fewer. A softer signal, so a softer
 *   cut.
 */
export function adaptBudget(budget: number, s: BudgetSignals): AdaptedBudget {
  if (budget <= 1) return { budget, effective: budget, reason: 'as_set' };
  if (s.due_soon > 0) return { budget, effective: budget, reason: 'deadline' };

  const enoughToJudge = s.nudges >= 3;
  if (enoughToJudge && s.ignored / s.nudges >= 0.75) {
    return { budget, effective: Math.max(1, Math.ceil(budget / 2)), reason: 'mostly_ignored' };
  }
  if (enoughToJudge && s.acks / s.nudges >= 0.5) {
    return { budget, effective: Math.max(1, budget - 1), reason: 'mostly_acked' };
  }
  return { budget, effective: budget, reason: 'as_set' };
}

/** What the last few days looked like. One query plus one count. */
export async function budgetSignals(user_id: string, now = new Date()): Promise<BudgetSignals> {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const res = await query<{ nudges: number; ignored: number; acks: number }>(
    `WITH nudges AS (
       SELECT m.id, m.created_at
       FROM messages m
       WHERE m.user_id = $1 AND m.direction = 'outbound' AND m.created_at >= $2
         AND m.status <> 'failed' AND COALESCE((m.metadata->>'counts_as_interrupt')::boolean, true)
         AND m.body <> ''
     ),
     replies AS (
       SELECT n.id,
              (SELECT m2.id FROM messages m2
                WHERE m2.user_id = $1 AND m2.direction = 'inbound'
                  AND m2.created_at > n.created_at
                  AND m2.created_at < n.created_at + INTERVAL '6 hours'
                ORDER BY m2.created_at ASC LIMIT 1) AS reply_id
       FROM nudges n
     )
     SELECT
       (SELECT COUNT(*)::int FROM nudges) AS nudges,
       (SELECT COUNT(*)::int FROM replies WHERE reply_id IS NULL) AS ignored,
       (SELECT COUNT(*)::int FROM replies r
          JOIN messages ack ON ack.id = r.reply_id
         WHERE ack.metadata->>'talkback' IS NULL
           AND ack.body ~* '^\\s*(ok|okay|k|fine|yeah|yes|yep|got it|on it|sure|alright)\\s*[.!]*\\s*$') AS acks`,
    [user_id, since]
  );
  const row = res.rows[0] ?? { nudges: 0, ignored: 0, acks: 0 };
  const due_soon = await ObligationRepository.countDueWithin(user_id, 24);
  return { nudges: row.nudges, ignored: row.ignored, acks: row.acks, due_soon };
}

export async function effectiveBudget(user_id: string, budget: number, now = new Date()): Promise<AdaptedBudget> {
  if (budget <= 1 || process.env.JIKO_ADAPTIVE_BUDGET === 'off') {
    return { budget, effective: budget, reason: 'as_set' };
  }
  return adaptBudget(budget, await budgetSignals(user_id, now));
}
