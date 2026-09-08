// src/services/messaging/outbox.ts
//
// The one door every outbound message goes through. Enforces the interrupt
// budget and quiet hours, records the message, and hands it to a deliverer.
import MessageRepository from '../repositories/MessageRepository.js';
import PreferencesRepository from '../repositories/PreferencesRepository.js';
import { query } from '../../db/psqlClient.js';
import { MessageT } from '../../types/message/Message.js';
import { inRange, localHHMM, startOfLocalDay } from '../triggers/time.js';
import { delivererFor } from './delivery.js';
import { DeliveryChannelT } from '../../types/user/UserPreferences.js';

export interface SendOptions {
  user_id: string;
  body: string;
  trigger_id?: string | null;
  reply_to_id?: string | null;
  /** Bypass budget and quiet hours. */
  urgent?: boolean;
  /** Replies to the user don't count against the budget; unsolicited nudges do. */
  counts_as_interrupt?: boolean;
  channel?: DeliveryChannelT;
  metadata?: Record<string, unknown>;
  now?: Date;
}

export type SendResult =
  | { sent: true; message: MessageT }
  | { sent: false; reason: 'budget_exhausted' | 'quiet_hours' | 'empty' };

export async function sendMessage(opts: SendOptions): Promise<SendResult> {
  const body = opts.body.trim();
  if (!body) return { sent: false, reason: 'empty' };
  const now = opts.now ?? new Date();
  const prefs = await PreferencesRepository.get(opts.user_id);
  const counts = opts.counts_as_interrupt ?? true;

  if (!opts.urgent && counts) {
    if (inRange(localHHMM(now, prefs.timezone), prefs.quiet_hours.start, prefs.quiet_hours.end)) {
      return { sent: false, reason: 'quiet_hours' };
    }
    const used = await MessageRepository.interruptsSince(opts.user_id, startOfLocalDay(now, prefs.timezone));
    if (used >= prefs.interrupt_budget_per_day) return { sent: false, reason: 'budget_exhausted' };
  }

  const channel = opts.channel ?? prefs.delivery_channel;
  const message = await MessageRepository.createOutbound({
    user_id: opts.user_id,
    body,
    channel,
    trigger_id: opts.trigger_id ?? null,
    reply_to_id: opts.reply_to_id ?? null,
    metadata: { ...(opts.metadata ?? {}), counts_as_interrupt: counts, urgent: Boolean(opts.urgent) },
  });

  const phone = channel === 'sms'
    ? (await query<{ phone_number: string }>('SELECT phone_number FROM users WHERE id = $1', [opts.user_id])).rows[0]?.phone_number
    : undefined;
  const outcome = await delivererFor(channel).deliver(message, { phone_number: phone ?? null });
  if (outcome.status !== 'queued') {
    await MessageRepository.ack(opts.user_id, [message.id], outcome.status);
    message.status = outcome.status;
  }
  return { sent: true, message };
}

/** Budget snapshot for the client ("2 of 4 nudges left today"). */
export async function budgetStatus(user_id: string, now = new Date()) {
  const prefs = await PreferencesRepository.get(user_id);
  const used = await MessageRepository.interruptsSince(user_id, startOfLocalDay(now, prefs.timezone));
  const quiet = inRange(localHHMM(now, prefs.timezone), prefs.quiet_hours.start, prefs.quiet_hours.end);
  return { used, budget: prefs.interrupt_budget_per_day, remaining: Math.max(0, prefs.interrupt_budget_per_day - used), quiet_hours_active: quiet };
}
