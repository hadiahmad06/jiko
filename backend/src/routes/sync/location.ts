import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { LocationData } from '../../types/user/LocationData.js';
import LocationManager from '../../data/LocationManager.js';

const router = Router();

// POST /sync/location - syncs location data
router.post('/sync/location', authMiddleware, async (req, res) => {
  try {
    const userId = req.uid!; // now set by middleware

    const parsed = LocationData.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });

    const result = await LocationManager.updateLocation(userId, parsed.data);
    if (!result.success) return res.status(result.code).json(result.details);
    
    return res.json(result.value);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred' });
  }
});

export default router;