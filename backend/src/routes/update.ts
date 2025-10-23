import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import userManager from '../UserManager.js';
import { AppUsageUpdateSchema } from '../types/AppUsageUpdate.js';

const router = Router();

router.post('/', authMiddleware, (req, res) => {
  const userId = req.userId; // now set by middleware

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: missing user ID' });
  }

  const parseResult = AppUsageUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.format() });
  }

  const update = parseResult.data;

  userManager.updateAppUsage(userId, update);

  return res.status(200).json({ status: 'updated', update });
});

export default router;