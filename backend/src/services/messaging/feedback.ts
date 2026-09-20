// src/services/messaging/feedback.ts
//
// "that was wrong" in one tap. The verdict is stored on the message, and a
// trigger that collects enough wrong verdicts inside a week turns itself off
// and says so. This is the smallest honest version of learning: no model, no
// scoring, just a rule that stops doing something the user keeps rejecting.
import MessageRepository from '../repositories/MessageRepository.js';
import TriggerRepository from '../repositories/TriggerRepository.js';
import { sendMessage } from './outbox.js';
import { MessageT } from '../../types/message/Message.js';

export type Verdict = 'wrong' | 'good';

/** Wrong verdicts inside this window that turn a trigger off. */
export const WRONG_LIMIT = Number(process.env.JIKO_WRONG_LIMIT || 3);
export const WRONG_WINDOW_DAYS = Number(process.env.JIKO_WRONG_WINDOW_DAYS || 7);

export interface FeedbackOutcome {
  message: MessageT;
  verdict: Verdict;
  trigger_id: string | null;
  wrong_in_window: number;
  disabled_trigger: boolean;
}

export async function recordFeedback(
  user_id: string,
  message: MessageT,
  verdict: Verdict,
  note: string | undefined,
  now = new Date()
): Promise<FeedbackOutcome> {
  await MessageRepository.tag(message.id, user_id, {
    feedback: verdict,
    feedback_at: now.toISOString(),
    ...(note ? { feedback_note: note.slice(0, 500) } : {}),
  });

  const trigger_id = message.trigger_id ?? null;
  if (!trigger_id || verdict !== 'wrong') {
    return { message, verdict, trigger_id, wrong_in_window: 0, disabled_trigger: false };
  }

  const since = new Date(now.getTime() - WRONG_WINDOW_DAYS * 86_400_000);
  const wrong = await MessageRepository.wrongSince(trigger_id, since);
  if (wrong < WRONG_LIMIT) {
    return { message, verdict, trigger_id, wrong_in_window: wrong, disabled_trigger: false };
  }

  const trigger = await TriggerRepository.get(trigger_id, user_id);
  if (!trigger.success || !trigger.value.enabled) {
    return { message, verdict, trigger_id, wrong_in_window: wrong, disabled_trigger: false };
  }

  await TriggerRepository.update(trigger_id, user_id, { enabled: false });
  // Telling the user is the point: a rule that goes quiet without saying so is
  // indistinguishable from a bug.
  await sendMessage({
    user_id,
    body: `that's ${wrong} times "${trigger.value.name}" got it wrong. turning it off. say "help" if you want it back.`,
    trigger_id,
    counts_as_interrupt: false,
    urgent: true,
    now,
    metadata: { kind: 'auto_disabled', trigger_id },
  });
  return { message, verdict, trigger_id, wrong_in_window: wrong, disabled_trigger: true };
}
