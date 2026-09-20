import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import MessageRepository from '../services/repositories/MessageRepository.js';
import { InboundMessage, MessageQuery, MessageAck } from '../types/message/Message.js';
import { parseOr400, serverError } from '../lib/http.js';
import { handleInbound } from '../services/messaging/talkback.js';
import { sendMessage, budgetStatus } from '../services/messaging/outbox.js';
import TriggerRepository from '../services/repositories/TriggerRepository.js';
import { describeFiring } from '../services/triggers/reason.js';
import { recordFeedback } from '../services/messaging/feedback.js';

const router = Router();

// GET /messages?status=&direction=&since=&before=&limit=
// Newest first. A full page sets `X-Jiko-Next-Before`; pass it back as
// `before` for the next page. Months of history stay one page at a time.
router.get('/messages', authMiddleware, async (req, res) => {
  try {
    const q = parseOr400(res, MessageQuery, req.query, 'Query'); if (!q) return;
    const items = await MessageRepository.list(req.uid!, q);
    if (items.length === q.limit) {
      const oldest = items[items.length - 1]!;
      res.setHeader('X-Jiko-Next-Before', new Date(oldest.created_at).toISOString());
    }
    res.json(items);
  } catch (err) { serverError(res, err, 'listing messages'); }
});

// GET /messages/queued?channel=agent - what a device should display next (oldest first)
router.get('/messages/queued', authMiddleware, async (req, res) => {
  try { res.json(await MessageRepository.queued(req.uid!, typeof req.query.channel === 'string' ? req.query.channel : undefined)); }
  catch (err) { serverError(res, err, 'listing queued messages'); }
});

// POST /messages/ack { ids, status }
router.post('/messages/ack', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, MessageAck, req.body); if (!body) return;
    res.json({ updated: await MessageRepository.ack(req.uid!, body.ids, body.status) });
  } catch (err) { serverError(res, err, 'acknowledging messages'); }
});

// GET /messages/budget
router.get('/messages/budget', authMiddleware, async (req, res) => {
  try { res.json(await budgetStatus(req.uid!)); }
  catch (err) { serverError(res, err, 'fetching budget'); }
});

// GET /messages/:id/why - the firing behind a nudge, in one sentence
router.get('/messages/:id/why', authMiddleware, async (req, res) => {
  try {
    const message = await MessageRepository.get(req.params.id as string, req.uid!);
    if (!message) return res.status(404).json({ error: 'NotFound', message: 'Message not found' });

    const firing = await TriggerRepository.firingForMessage(message.id, req.uid!);
    if (!firing) {
      // Replies, summaries and self-sends have no firing behind them.
      const source = typeof message.metadata?.talkback === 'string'
        ? 'you said something and i answered.'
        : typeof message.metadata?.kind === 'string' && message.metadata.kind === 'daily_summary'
          ? 'end of day. this one never counts against your budget.'
          : message.trigger_id ? 'a rule sent this, but the firing has since been deleted.' : 'you asked for this one.';
      return res.json({ message_id: message.id, trigger: null, firing: null, reason: source });
    }

    const trigger = await TriggerRepository.get(firing.trigger_id, req.uid!);
    const context = firing.context as { reason?: string };
    res.json({
      message_id: message.id,
      trigger: trigger.success ? { id: trigger.value.id, name: trigger.value.name, kind: trigger.value.kind, source: trigger.value.source } : null,
      firing: { id: firing.id, fired_at: firing.fired_at, context: firing.context },
      reason: context.reason ?? describeFiring(firing.context as never),
    });
  } catch (err) { serverError(res, err, 'explaining a message'); }
});

// POST /messages/:id/feedback { verdict: 'wrong' | 'good', note? }
// One tap on a nudge. Three "wrong" in a week turns the rule off.
router.post('/messages/:id/feedback', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, z.object({
      verdict: z.enum(['wrong', 'good']),
      note: z.string().max(500).optional(),
    }), req.body); if (!body) return;

    const message = await MessageRepository.get(req.params.id as string, req.uid!);
    if (!message) return res.status(404).json({ error: 'NotFound', message: 'Message not found' });
    if (message.direction !== 'outbound') {
      return res.status(400).json({ error: 'InvalidBody', message: 'Only Jiko\'s own messages can be graded.' });
    }

    const outcome = await recordFeedback(req.uid!, message, body.verdict, body.note);
    res.json({
      message_id: message.id,
      verdict: outcome.verdict,
      trigger_id: outcome.trigger_id,
      wrong_in_window: outcome.wrong_in_window,
      disabled_trigger: outcome.disabled_trigger,
    });
  } catch (err) { serverError(res, err, 'recording feedback'); }
});

// POST /messages - user talks to Jiko
router.post('/messages', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, InboundMessage, req.body); if (!body) return;
    const inbound = await MessageRepository.createInbound({ user_id: req.uid!, body: body.body, channel: body.channel, reply_to_id: body.reply_to_id ?? null });
    const outcome = await handleInbound(req.uid!, inbound);
    res.status(201).json({ message: inbound, ...outcome });
  } catch (err) { serverError(res, err, 'handling a message'); }
});

// POST /messages/send - self-nudge / debug: queue an outbound message as Jiko
router.post('/messages/send', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, z.object({ body: z.string().min(1).max(1000), urgent: z.boolean().default(false), counts_as_interrupt: z.boolean().default(true) }), req.body); if (!body) return;
    const r = await sendMessage({ user_id: req.uid!, body: body.body, urgent: body.urgent, counts_as_interrupt: body.counts_as_interrupt, metadata: { source: 'api' } });
    if (!r.sent) return res.status(409).json({ error: 'NotSent', message: r.reason });
    res.status(201).json(r.message);
  } catch (err) { serverError(res, err, 'sending a message'); }
});

export default router;
