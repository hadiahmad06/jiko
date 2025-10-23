import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import userManager from '../UserManager';
import { AppUsageUpdateSchema } from '../types/AppUsageUpdate';

const router = Router();

router.post('/update', authMiddleware, (req, res) => {
  const userId = req.userId; // now set by middleware

  if (!userId) {
    console.error('[UPDATE] ❌ Missing userId in request');
    return res.status(401).json({ error: 'Unauthorized: missing user ID' });
  }

  console.log(`[UPDATE] Received update from user ${userId}`);
  console.log('[UPDATE] Raw body:', req.body);

  const parseResult = AppUsageUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    console.error('[UPDATE] ❌ Validation failed:', parseResult.error.format());
    return res.status(400).json({ error: parseResult.error.format() });
  }

  const update = parseResult.data;
  console.log('[UPDATE] ✅ Parsed data:', update);

  userManager.updateAppUsage(userId, update);
  console.log(`[UPDATE] ✅ Successfully updated app usage for ${userId}`);

  res.json({ status: 'updated', update });
});

export default router;