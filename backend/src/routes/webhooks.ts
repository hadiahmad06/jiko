// src/routes/webhooks.ts
//
// Inbound SMS. Unauthenticated by design (the carrier has no token), so it is
// guarded by a shared secret in the path query and by the fact that a number
// that belongs to no user is dropped.
import express, { Router } from 'express';
import MessageRepository from '../services/repositories/MessageRepository.js';
import { handleInbound } from '../services/messaging/talkback.js';
import { serverError } from '../lib/http.js';
import { alreadySeen, parseWebhookBody, userIdForPhone } from '../services/messaging/smsInbound.js';

const router = Router();

// SNS posts text/plain; the global JSON parser leaves those alone.
const rawText = express.text({ type: ['text/plain', 'text/*'], limit: '256kb' });

function secretOk(req: express.Request): boolean {
  const expected = process.env.JIKO_SMS_WEBHOOK_SECRET;
  if (!expected) return true; // unset = open, for local runs
  const given = req.query.secret ?? req.headers['x-jiko-secret'];
  return typeof given === 'string' && given === expected;
}

// POST /webhooks/sms
router.post('/webhooks/sms', rawText, async (req, res) => {
  try {
    if (!secretOk(req)) return res.status(401).json({ error: 'Unauthorized', message: 'Bad webhook secret.' });

    const envelope = parseWebhookBody(req.body);

    if (envelope.kind === 'subscription_confirmation') {
      // Confirming subscribes this endpoint to the topic; only do it on purpose.
      if (process.env.JIKO_SMS_AUTO_CONFIRM === 'true') {
        try {
          await fetch(envelope.subscribe_url);
          console.log('[webhooks/sms] confirmed SNS subscription', envelope.topic_arn ?? '');
          return res.json({ ok: true, confirmed: true });
        } catch (err) {
          console.warn('[webhooks/sms] confirmation fetch failed:', (err as Error).message);
          return res.status(502).json({ error: 'ConfirmFailed', message: 'Could not reach the SubscribeURL.' });
        }
      }
      console.log('[webhooks/sms] SNS subscription pending. Confirm URL:', envelope.subscribe_url);
      return res.json({ ok: true, confirmed: false });
    }

    if (envelope.kind === 'unsubscribe_confirmation') return res.json({ ok: true });
    if (envelope.kind !== 'notification' || !envelope.sms) {
      return res.status(400).json({ error: 'InvalidBody', message: 'Unrecognised SMS payload.' });
    }

    const { from, body, provider_id } = envelope.sms;
    if (provider_id && await alreadySeen(provider_id)) return res.json({ ok: true, duplicate: true });

    const user_id = await userIdForPhone(from);
    if (!user_id) {
      console.warn('[webhooks/sms] no user for', from);
      return res.json({ ok: true, matched: false });
    }

    const text = body.trim().slice(0, 2000);
    if (!text) return res.json({ ok: true, matched: true, empty: true });

    const inbound = await MessageRepository.createInbound({
      user_id,
      body: text,
      channel: 'sms',
      metadata: { source: 'webhook:sms', from, ...(provider_id ? { provider_id } : {}) },
    });
    const outcome = await handleInbound(user_id, inbound);
    res.json({ ok: true, matched: true, intent: outcome.intent });
  } catch (err) { serverError(res, err, 'handling an inbound sms'); }
});

export default router;
