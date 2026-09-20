// src/services/messaging/smsInbound.ts
//
// Parsing for inbound SMS. Two-way SMS on AWS (Pinpoint / End User Messaging)
// publishes to an SNS topic; an HTTPS subscription posts the envelope here as
// `text/plain`. A plain `{ from, body }` JSON post is also accepted so the
// channel can be exercised without AWS.
import { query } from '../../db/psqlClient.js';

export interface InboundSms {
  from: string;          // E.164 origination number
  body: string;
  provider_id?: string;  // provider message id, for dedupe
}

export type SnsEnvelope =
  | { kind: 'subscription_confirmation'; subscribe_url: string; topic_arn?: string }
  | { kind: 'notification'; sms: InboundSms | null }
  | { kind: 'unsubscribe_confirmation' }
  | { kind: 'unknown' };

/** Normalise to E.164-ish: keep a leading +, drop everything but digits. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  return trimmed.startsWith('+') ? `+${digits}` : `+${digits}`;
}

/** The SMS payload inside an SNS notification `Message` string. */
export function parseSnsSmsMessage(message: string): InboundSms | null {
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(message) as Record<string, unknown>; }
  catch { return null; }

  const from = payload.originationNumber ?? payload.originationPhoneNumber ?? payload.from;
  const body = payload.messageBody ?? payload.message ?? payload.body;
  if (typeof from !== 'string' || typeof body !== 'string') return null;
  const id = payload.inboundMessageId ?? payload.messageId;
  return { from: normalizePhone(from), body, ...(typeof id === 'string' ? { provider_id: id } : {}) };
}

/** Classify a raw request body (SNS envelope, or a plain `{from, body}`). */
export function parseWebhookBody(raw: unknown): SnsEnvelope {
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw) as Record<string, unknown>; } catch { return { kind: 'unknown' }; }
  } else if (raw && typeof raw === 'object') {
    obj = raw as Record<string, unknown>;
  }
  if (!obj) return { kind: 'unknown' };

  const type = typeof obj.Type === 'string' ? obj.Type : undefined;
  if (type === 'SubscriptionConfirmation') {
    return typeof obj.SubscribeURL === 'string'
      ? { kind: 'subscription_confirmation', subscribe_url: obj.SubscribeURL, ...(typeof obj.TopicArn === 'string' ? { topic_arn: obj.TopicArn } : {}) }
      : { kind: 'unknown' };
  }
  if (type === 'UnsubscribeConfirmation') return { kind: 'unsubscribe_confirmation' };
  if (type === 'Notification') {
    return { kind: 'notification', sms: typeof obj.Message === 'string' ? parseSnsSmsMessage(obj.Message) : null };
  }

  // Direct post: { from, body } (or the SNS inner payload on its own).
  const from = obj.from ?? obj.originationNumber;
  const body = obj.body ?? obj.messageBody;
  if (typeof from === 'string' && typeof body === 'string') {
    return { kind: 'notification', sms: { from: normalizePhone(from), body, ...(typeof obj.message_id === 'string' ? { provider_id: obj.message_id } : {}) } };
  }
  return { kind: 'unknown' };
}

/** Which user owns a phone number. Matches on the stored digits, not formatting. */
export async function userIdForPhone(phone: string): Promise<string | null> {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  const res = await query<{ id: string }>(
    `SELECT id FROM users WHERE regexp_replace(phone_number, '\\D', '', 'g') = $1 LIMIT 1`,
    [digits]
  );
  return res.rows[0]?.id ?? null;
}

/** True when this provider message id was already stored. */
export async function alreadySeen(provider_id: string): Promise<boolean> {
  const res = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM messages WHERE direction = 'inbound' AND metadata->>'provider_id' = $1`,
    [provider_id]
  );
  return (res.rows[0]?.n ?? 0) > 0;
}
