import ActivityManager from '../../data/ActivityManager.js';
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { ActivityQuery } from '../../services/ActivityRepository.js';

const router = Router();

// GET /activities/entries - fetch entries for a specific activity
router.get('/activities/entries', authMiddleware, async (req, res) => {
  try {
    const options = req.query;
    const userId = req.userId;

    if (!userId) { return res.status(400).json({ error: 'MissingParameter', message: 'User id is required.' }); }
    if (!options) { return res.status(400).json({ error: 'MissingParameter', message: 'Options are required.' }); }

    const query = options as Partial<ActivityQuery>;
    const entries = await ActivityManager.getEntries(query, userId);
    
    if (!entries) { return res.status(404).json({ error: 'NotFound', message: `Entries not found.` }); }
    res.json(entries);
  } catch (error) {
    console.error(`Error fetching entries for activity with id ${req.params.id}:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while fetching activity entries.' });
  }
});

export default router;