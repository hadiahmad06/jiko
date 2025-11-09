import ActivityManager from '../../data/ActivityManager.js';
import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { ActivityQuery, PartialActivityWithIds } from '../../services/ActivityRepository.js';
import { ActivityEntry } from '../../types/activity/ActivityEntry.js';

const router = Router();

// POST /activities/entries - create a new activity entry
router.post('/activities/entries', authMiddleware, async (req, res) => {
  try {
    // Get Auth
    const user_id = req.userId!;
    const body = req.body;
    delete body.user_id

    if (!body)  return res.status(400).json({ error: 'MissingParameter', message: 'Activity Body is required.' });
  
    // Validate Body
    const parsed = await ActivityEntry.safeParse({ user_id, ...req.body });
    if (!parsed.success) return res.status(400).json({ error: 'InvalidBody', message: 'Activity Body is invalid.', details: parsed.error.issues });

    // Validate Insert
    const newEntry = await ActivityManager.addEntry(parsed.data);
    if (!newEntry.success) return res.status(newEntry.code).json(newEntry.details);

    res.json(newEntry);
  } catch (error) {
    console.error(`Error creating entry for activity with id ${req.params.id}:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while creating activity entry.' });
  }
});

// TODO: add tests
// PATCH /activities/entries - update an activity entry
router.patch('/activities/entries', authMiddleware, async (req, res) => {
  try {
    const { user_id, ...rest } = req.body;
    const userId = req.userId!;

    if (!rest) return res.status(400).json({ error: 'MissingParameter', message: 'Activity Body is required.' });

    const body = PartialActivityWithIds.safeParse({ userId, ...rest});
    if (!body.success) return res.status(400).json({ error: 'InvalidBody', message: 'Activity Body is invalid.', details: body.error.issues });

    const entries = await ActivityManager.updateEntry(body.data);
    if (!entries.success) return res.status(entries.code).json(entries.details);
    res.json(entries);
  } catch (error) {
    console.error(`Error fetching entries for activity with id ${req.params.id}:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while fetching activity entries.' });
  }
});

// GET /activities/entries - fetch entries following a query
router.get('/activities/entries', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!
    const query = req.query;
    if (!query) return res.status(400).json({ error: 'MissingParameter', message: 'Options are required.' });

    console.log("query: ", query)
    const parsed = ActivityQuery.safeParse(query);
    if (!parsed.success) return res.status(400).json({ error: 'InvalidQuery', message: 'Query parameters are invalid.', details: parsed.error.issues });

    const entries = await ActivityManager.getEntries(parsed.data, userId);
    
    if (!entries.success) return res.status(entries.code).json(entries.details);
    res.json(entries);
  } catch (error) {
    console.error(`Error fetching entries for activity with id ${req.params.id}:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while fetching activity entries.' });
  }
});

// DELETE /activities/entries/:id
router.delete('/activities/entries/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    if (!id) { return res.status(400).json({ error: 'MissingParameter', message: 'Activity id is required.' }); }

    const result = await ActivityManager.deleteEntry(id, userId);
    if (!result) { return res.status(404).json({ error: 'NotFound', message: `Activity Entry with id ${id} not found for deletion.` }); }

    res.json(result);
  } catch (error) {
    console.error(`Error deleting activity entry with id ${req.params.id}:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while deleting the activity entry.' });
  }
});

export default router;