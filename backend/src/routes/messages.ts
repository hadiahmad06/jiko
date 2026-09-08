import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import MessageRepository from '../services/repositories/MessageRepository.js';
import { InboundMessage, MessageQuery, MessageAck } from '../types/message/Message.js';
import { parseOr400, serverError } from '../lib/http.js';
import { handleInbound } from '../services/messaging/talkback.js';
import { sendMessage, budgetStatus } from '../services/messaging/outbox.js';

const router = Router();

// GET /messages?status=&direction=&since=&limit=
router.get('/messages', authMiddleware, async (req, res) => {
  try {
    const q = parseOr400(res, MessageQuery, req.query, 'Query'); if (!q) return;
    res.json(await MessageRepository.list(req.uid!, q));
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
