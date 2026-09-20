// src/types/message/Message.ts
import { z } from "zod";

export const MessageDirection = z.enum(["outbound", "inbound"]);
export const MessageStatus = z.enum(["queued", "sent", "delivered", "failed", "received"]);

export const Message = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  direction: MessageDirection,
  channel: z.string(),
  body: z.string(),
  status: MessageStatus,
  trigger_id: z.uuid().nullable().optional(),
  reply_to_id: z.uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.coerce.date(),
  sent_at: z.coerce.date().nullable().optional(),
  delivered_at: z.coerce.date().nullable().optional(),
});
export type MessageT = z.infer<typeof Message>;

// User -> Jiko. The agent (or an SMS webhook) posts this.
export const InboundMessage = z.object({
  body: z.string().min(1).max(2000),
  channel: z.string().default("agent"),
  reply_to_id: z.uuid().optional(),
});
export type InboundMessageT = z.infer<typeof InboundMessage>;

export const MessageQuery = z.object({
  status: MessageStatus.optional(),
  direction: MessageDirection.optional(),
  since: z.coerce.date().optional(),
  /** Cursor: only messages older than this. Paired with the `X-Jiko-Next-Before`
   *  response header, it walks backwards through a long conversation. */
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
export type MessageQueryT = z.infer<typeof MessageQuery>;

export const MessageAck = z.object({
  ids: z.array(z.uuid()).min(1).max(200),
  status: z.enum(["sent", "delivered", "failed"]).default("delivered"),
});
