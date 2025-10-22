import { Router } from 'express';
import userManager from '../UserManager.js';
import type { AppUsageUpdate } from '../types.js';

const router = Router();

router.post('/', (req, res) => {
  const { key, appName } = req.body as AppUsageUpdate;
  if (!key || !appName) return res.status(400).json({ error: 'Missing key or appName' });

  userManager.stopApp(key, appName);
  res.json({ status: 'stopped', key, appName });
});

export default router;