import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import userManager from '../data/UserManager.js';
import { AppUsageUpdate } from '../types/appUsage/AppUsageUpdate.js';

const router = Router();

// POST /update - update user's app usage data
router.post('/update', authMiddleware, (req, res) => {
  try {
    const userId = req.uid; // now set by middleware

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: missing user ID' });
    }

    const parseResult = AppUsageUpdate.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.format() });
    }

    const update = parseResult.data;

    userManager.updateAppUsage(userId, update);

    return res.status(200).json({ status: 'updated', update });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred' });
  }
});

export default router;