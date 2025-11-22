import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import AppUsageManager from '../../data/AppUsageManager.js';
import { AppUsageData } from '../../types/user/AppUsageData.js';

const router = Router();

// POST /sync/app-usage - update user's app usage data
router.post('/sync/app-usage', authMiddleware, async (req, res) => {
  try {
    const userId = req.uid!; // now set by middleware

    const parseResult = AppUsageData.safeParse(req.body);
    if (!parseResult.success) return res.status(400).json({ error: parseResult.error.format() });

    const result = await AppUsageManager.updateAppUsage(userId, parseResult.data);
    if (!result.success) return res.status(result.code).json(result.details);
    
    return res.json(result.value);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred' });
  }
});

export default router;