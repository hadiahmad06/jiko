import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import HealthManager from '../../data/HealthManager.js';
import { HealthData } from '../../types/user/sync/HealthData.js';

const router = Router();

// POST /sync/health - syncs health data
router.post('/sync/health', authMiddleware, async (req, res) => {
  try {
    const userId = req.uid!; // now set by middleware

    const parsed = HealthData.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });

    const result = await HealthManager.updateHealth(userId, parsed.data);
    if (!result.success) return res.status(result.code).json(result.details);
    
    return res.json(result.value);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred' });
  }
});

export default router;