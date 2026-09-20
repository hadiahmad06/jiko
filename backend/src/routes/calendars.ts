// src/routes/calendars.ts
//
// Stored ICS subscriptions. Adding one imports it straight away so the user
// sees their week fill in while they are still looking at the screen.
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { parseOr400, serverError } from '../lib/http.js';
import {
  Calendars,
  CalendarSubscriptionCreate,
  CalendarSubscriptionUpdate,
  importSubscription,
  normalizeIcsUrl,
} from '../services/calendars.js';

const router = Router();

// GET /calendars
router.get('/calendars', authMiddleware, async (req, res) => {
  try { res.json(await Calendars.list(req.uid!)); }
  catch (err) { serverError(res, err, 'listing calendars'); }
});

// POST /calendars { url, name?, window_days?, refresh_hours? }
router.post('/calendars', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, CalendarSubscriptionCreate, req.body); if (!body) return;
    const url = normalizeIcsUrl(body.url);
    if (!url.ok) return res.status(400).json({ error: 'InvalidBody', message: url.reason });
    const sub = await Calendars.create(req.uid!, { ...body, url: url.url });
    const result = await importSubscription(sub);
    const fresh = await Calendars.get(sub.id, req.uid!);
    res.status(201).json({ subscription: fresh ?? sub, import: result });
  } catch (err) { serverError(res, err, 'adding a calendar'); }
});

// PATCH /calendars/:id
router.patch('/calendars/:id', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, CalendarSubscriptionUpdate, req.body); if (!body) return;
    const sub = await Calendars.update(req.params.id as string, req.uid!, body);
    if (!sub) return res.status(404).json({ error: 'NotFound', message: 'Calendar not found' });
    res.json(sub);
  } catch (err) { serverError(res, err, 'updating a calendar'); }
});

// POST /calendars/:id/refresh - import now, ignoring the refresh window
router.post('/calendars/:id/refresh', authMiddleware, async (req, res) => {
  try {
    const sub = await Calendars.get(req.params.id as string, req.uid!);
    if (!sub) return res.status(404).json({ error: 'NotFound', message: 'Calendar not found' });
    const result = await importSubscription(sub);
    res.json({ subscription: await Calendars.get(sub.id, req.uid!), import: result });
  } catch (err) { serverError(res, err, 'refreshing a calendar'); }
});

// DELETE /calendars/:id - the obligations it imported stay put
router.delete('/calendars/:id', authMiddleware, async (req, res) => {
  try {
    const ok = await Calendars.delete(req.params.id as string, req.uid!);
    if (!ok) return res.status(404).json({ error: 'NotFound', message: 'Calendar not found' });
    res.status(204).end();
  } catch (err) { serverError(res, err, 'deleting a calendar'); }
});

export default router;
