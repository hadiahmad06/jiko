import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import LocationRepository from '../services/repositories/LocationRepository.js';
import { LocationCreate, LocationUpdate } from '../types/location/Location.js';
import { parseOr400, sendResult, serverError } from '../lib/http.js';

const router = Router();

// GET /locations
router.get('/locations', authMiddleware, async (req, res) => {
  try {
    res.json(await LocationRepository.list(req.uid!, req.query.archived === 'true'));
  } catch (err) { serverError(res, err, 'listing locations'); }
});

// POST /locations
router.post('/locations', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, LocationCreate, req.body); if (!body) return;
    res.status(201).json(await LocationRepository.create(req.uid!, body));
  } catch (err) { serverError(res, err, 'creating a location'); }
});

// GET /locations/:id
router.get('/locations/:id', authMiddleware, async (req, res) => {
  try { sendResult(res, await LocationRepository.get(req.params.id as string, req.uid!)); }
  catch (err) { serverError(res, err, 'fetching a location'); }
});

// PATCH /locations/:id
router.patch('/locations/:id', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, LocationUpdate, req.body); if (!body) return;
    sendResult(res, await LocationRepository.update(req.params.id as string, req.uid!, body));
  } catch (err) { serverError(res, err, 'updating a location'); }
});

// DELETE /locations/:id
router.delete('/locations/:id', authMiddleware, async (req, res) => {
  try {
    const ok = await LocationRepository.delete(req.params.id as string, req.uid!);
    if (!ok) return res.status(404).json({ error: 'NotFound', message: 'Location not found' });
    res.status(204).end();
  } catch (err) { serverError(res, err, 'deleting a location'); }
});

export default router;
