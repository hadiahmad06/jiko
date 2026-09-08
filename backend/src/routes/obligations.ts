import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import ObligationRepository from '../services/repositories/ObligationRepository.js';
import { ObligationCreate, ObligationUpdate, ObligationQuery } from '../types/obligation/Obligation.js';
import { parseOr400, sendResult, serverError } from '../lib/http.js';
import { parseQuickAdd } from '../services/quickadd.js';
import { z } from 'zod';

const router = Router();

// GET /obligations?kind=&completed=&archived=&due_before=&due_after=&limit=
router.get('/obligations', authMiddleware, async (req, res) => {
  try {
    const q = parseOr400(res, ObligationQuery, req.query, 'Query'); if (!q) return;
    res.json(await ObligationRepository.list(req.uid!, q));
  } catch (err) { serverError(res, err, 'listing obligations'); }
});

// GET /obligations/upcoming?hours=48
router.get('/obligations/upcoming', authMiddleware, async (req, res) => {
  try { res.json(await ObligationRepository.dueWithin(req.uid!, Math.max(1, Number(req.query.hours) || 48))); }
  catch (err) { serverError(res, err, 'listing upcoming obligations'); }
});

// POST /obligations
router.post('/obligations', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, ObligationCreate, req.body); if (!body) return;
    sendResult(res, await ObligationRepository.create(req.uid!, body), 201);
  } catch (err) { serverError(res, err, 'creating an obligation'); }
});

// POST /obligations/quick  { text: "OS midterm thu 2pm" }  -> parsed obligation
router.post('/obligations/quick', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, z.object({ text: z.string().min(1).max(300), timezone: z.string().optional() }), req.body); if (!body) return;
    const { default: PreferencesRepository } = await import('../services/repositories/PreferencesRepository.js');
    const tz = body.timezone ?? (await PreferencesRepository.get(req.uid!)).timezone;
    const parsed = parseQuickAdd(body.text, new Date(), tz);
    if (!parsed) return res.status(400).json({ error: 'Unparseable', message: "couldn't find a date in that. try 'thing due friday 5pm'." });
    sendResult(res, await ObligationRepository.create(req.uid!, { ...parsed, source: 'quick' }), 201);
  } catch (err) { serverError(res, err, 'quick-adding an obligation'); }
});

// GET /obligations/:id
router.get('/obligations/:id', authMiddleware, async (req, res) => {
  try { sendResult(res, await ObligationRepository.get(req.params.id as string, req.uid!)); }
  catch (err) { serverError(res, err, 'fetching an obligation'); }
});

// PATCH /obligations/:id
router.patch('/obligations/:id', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, ObligationUpdate, req.body); if (!body) return;
    sendResult(res, await ObligationRepository.update(req.params.id as string, req.uid!, body));
  } catch (err) { serverError(res, err, 'updating an obligation'); }
});

// POST /obligations/:id/complete
router.post('/obligations/:id/complete', authMiddleware, async (req, res) => {
  try { sendResult(res, await ObligationRepository.update(req.params.id as string, req.uid!, { completed: true })); }
  catch (err) { serverError(res, err, 'completing an obligation'); }
});

// DELETE /obligations/:id
router.delete('/obligations/:id', authMiddleware, async (req, res) => {
  try {
    const ok = await ObligationRepository.delete(req.params.id as string, req.uid!);
    if (!ok) return res.status(404).json({ error: 'NotFound', message: 'Obligation not found' });
    res.status(204).end();
  } catch (err) { serverError(res, err, 'deleting an obligation'); }
});

export default router;
