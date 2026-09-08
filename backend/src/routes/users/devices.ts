import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import DeviceRepository from '../../services/repositories/DeviceRepository.js';
import { DeviceRegister, DeviceUpdate } from '../../types/user/device/Device.js';
import { parseOr400, sendResult, serverError } from '../../lib/http.js';

const router = Router();

router.get('/users/devices', authMiddleware, async (req, res) => {
  try { res.json(await DeviceRepository.list(req.uid!)); }
  catch (err) { serverError(res, err, 'listing devices'); }
});

// POST /users/devices - idempotent on id
router.post('/users/devices', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, DeviceRegister, req.body); if (!body) return;
    res.status(201).json(await DeviceRepository.register(req.uid!, body));
  } catch (err) { serverError(res, err, 'registering a device'); }
});

router.get('/users/devices/:id', authMiddleware, async (req, res) => {
  try { sendResult(res, await DeviceRepository.get(req.params.id as string, req.uid!)); }
  catch (err) { serverError(res, err, 'fetching a device'); }
});

router.patch('/users/devices/:id', authMiddleware, async (req, res) => {
  try {
    const body = parseOr400(res, DeviceUpdate, req.body); if (!body) return;
    sendResult(res, await DeviceRepository.update(req.params.id as string, req.uid!, body));
  } catch (err) { serverError(res, err, 'updating a device'); }
});

router.delete('/users/devices/:id', authMiddleware, async (req, res) => {
  try {
    const ok = await DeviceRepository.delete(req.params.id as string, req.uid!);
    if (!ok) return res.status(404).json({ error: 'NotFound', message: 'Device not found' });
    res.status(204).end();
  } catch (err) { serverError(res, err, 'deleting a device'); }
});

export default router;
