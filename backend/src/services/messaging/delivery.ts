// src/services/messaging/delivery.ts
//
// Delivery adapters. `agent` leaves the message queued for a device to pull
// (GET /messages/queued); `imessage` does the same, but the macOS agent hands
// it to Messages.app instead of showing a notification; `console` prints;
// `webhook` POSTs; `sms` uses SNS.
import { MessageT } from '../../types/message/Message.js';
import { DeliveryChannelT } from '../../types/user/UserPreferences.js';

export interface DeliveryOutcome {
  status: 'queued' | 'sent' | 'failed';
  detail?: string;
}

export interface Deliverer {
  deliver(msg: MessageT, ctx: { phone_number?: string | null }): Promise<DeliveryOutcome>;
}

const agent: Deliverer = { async deliver() { return { status: 'queued' }; } };

// Same contract as `agent`: the device pulls it. The difference is what the
// device does with it (Messages.app, addressed to the user's own number).
const imessage: Deliverer = {
  async deliver(_msg, ctx) {
    if (!ctx.phone_number) return { status: 'failed', detail: 'user has no phone number' };
    return { status: 'queued' };
  },
};

const consoleDeliverer: Deliverer = {
  async deliver(msg) {
    console.log(`[jiko -> ${msg.user_id}] ${msg.body}`);
    return { status: 'sent' };
  },
};

const webhook: Deliverer = {
  async deliver(msg) {
    const url = process.env.JIKO_WEBHOOK_URL;
    if (!url) return { status: 'failed', detail: 'JIKO_WEBHOOK_URL not set' };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(process.env.JIKO_WEBHOOK_SECRET ? { 'x-jiko-secret': process.env.JIKO_WEBHOOK_SECRET } : {}) },
        body: JSON.stringify({ id: msg.id, user_id: msg.user_id, body: msg.body, trigger_id: msg.trigger_id, created_at: msg.created_at }),
      });
      return res.ok ? { status: 'sent' } : { status: 'failed', detail: `webhook ${res.status}` };
    } catch (err) {
      return { status: 'failed', detail: (err as Error).message };
    }
  },
};

const sms: Deliverer = {
  async deliver(msg, ctx) {
    if (!ctx.phone_number) return { status: 'failed', detail: 'user has no phone number' };
    try {
      const { SNSClient, PublishCommand } = await import('@aws-sdk/client-sns');
      const client = new SNSClient({ region: process.env.AWS_REGION || 'us-east-2' });
      await client.send(new PublishCommand({ PhoneNumber: ctx.phone_number, Message: msg.body }));
      return { status: 'sent' };
    } catch (err) {
      return { status: 'failed', detail: (err as Error).message };
    }
  },
};

const deliverers: Record<DeliveryChannelT, Deliverer> = { agent, imessage, console: consoleDeliverer, webhook, sms };

let override: Deliverer | null = null;
/** Tests can swap the deliverer. */
export function setDelivererForTests(d: Deliverer | null) { override = d; }

export function delivererFor(channel: DeliveryChannelT): Deliverer {
  return override ?? deliverers[channel] ?? agent;
}
