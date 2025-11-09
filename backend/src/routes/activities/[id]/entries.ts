import ActivityManager from '../../../data/ActivityManager.js';
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../../middleware/auth.js';
import { ActivityQuery } from '../../../services/ActivityRepository.js';

const router = Router();

// GET /activities/:id/entries - fetch entries for a specific activity
router.get('/activities/:id/entries', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const query = req.query;
    
    if (!id) return res.status(400).json({ error: 'MissingParameter', message: 'Activity id is required.' });
    if (!query) return res.status(400).json({ error: 'InvalidQuery', message: 'Query is missing.'});
    
    const parsed = ActivityQuery.safeParse(query);
    if (!parsed.success) return res.status(400).json({ error: 'InvalidQuery', message: 'Query parameters are invalid.', details: parsed.error.issues });
    const entries = await ActivityManager.getActivityEntries(id, parsed.data, userId);

    if (!entries) {
      return res.status(404).json({ error: 'NotFound', message: `Entries for activity id ${id} not found.` });
    }
    res.json(entries);
  } catch (error) {
    console.error(`Error fetching entries for activity with id ${req.params.id}:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while fetching activity entries.' });
  }
});

export default router;
