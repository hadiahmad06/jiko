import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import userManager from '../UserManager';
import { AppUsageUpdateSchema } from '../types/AppUsageUpdate';

const router = Router();

router.post('/update', authMiddleware, (req, res) => {
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

  res.json({ status: 'updated', update });
});

export default router;