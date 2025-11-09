import { authMiddleware } from '../middleware/auth.js';
import ActivityManager from '../data/ActivityManager.js';
import { Router, Request, Response } from 'express';
import { Activity } from '../types/activity/Activity.js';
import { ActivityQuery, PartialActivityWithIds } from '../services/ActivityRepository.js';
import { ActivityEntry } from '../types/activity/ActivityEntry.js';

const router = Router();

// POST /activities - create a specific activity
router.post('/activities', authMiddleware, async (req, res) => {
  try {
    const user_id = req.uid!;
    const body = req.body;
    delete body.user_id

    const parsed = Activity.safeParse({ user_id, ...body })
    if (!parsed.success) return res.status(400).json({ error: 'InvalidBody', message: 'Activity Body is invalid.', details: parsed.error.issues });
    
    const result = await ActivityManager.createActivity(parsed.data);
    if (!result.success) { return res.status(result.code).json(result.details); }

    res.status(201).json(result.value);
  } catch (error) {
    console.error(`Error creating activity with id ${req.params.id}:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while creating the activity.' });
  }
});

// GET /activities - gets all activities owned by the user
router.get('/activities', authMiddleware, async (req, res) => {
  try {
    const userId = req.uid!;

    const result = await ActivityManager.getActivities(userId);
    if (!result.success) { return res.status(result.code).json(result.details); }

    res.status(200).json(result.value);
  } catch (error) {
    console.error(`Error fetching activities for user:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while fetching activities owned by the user.' });
  }
});

// POST /activities/entries - create a new activity entry
router.post('/activities/entries', authMiddleware, async (req, res) => {
  try {
    // Get Auth
    const user_id = req.uid!;
    const body = req.body;
    delete body.user_id

    if (!body) return res.status(400).json({ error: 'MissingParameter', message: 'Activity Body is required.' });
  
    // Validate Body
    const parsed = ActivityEntry.safeParse({ user_id, ...body });
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
    const userId = req.uid!;

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
    const user_id = req.uid!
    let query = req.query;
    if (!req.query) return res.status(400).json({ error: 'MissingParameter', message: 'Options are required.' });
    
    let activityIds: string[] | undefined;
    if (query.activityIds) {
      if (Array.isArray(query.activityIds)) {
        activityIds = query.activityIds as string[];
      } else if (typeof query.activityIds === 'string') {
        activityIds = query.activityIds.split(',').map(s => s.trim());
      }
    }
    delete query.activityIds

    const parsed = ActivityQuery.safeParse({ activityIds, ...query });
    if (!parsed.success) return res.status(400).json({ error: 'InvalidQuery', message: 'Query parameters are invalid.', details: parsed.error.issues });

    const entries = await ActivityManager.getEntries(parsed.data, user_id);
    console.log(entries)
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
    const user_id = req.uid!;

    if (!id) { return res.status(400).json({ error: 'MissingParameter', message: 'Activity id is required.' }); }

    const result = await ActivityManager.deleteEntry(id, user_id);
    if (!result) { return res.status(404).json({ error: 'NotFound', message: `Activity Entry with id ${id} not found for deletion.` }); }

    res.json(result);
  } catch (error) {
    console.error(`Error deleting activity entry with id ${req.params.id}:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while deleting the activity entry.' });
  }
});

// GET /activities/:id/entries - fetch entries for a specific activity
router.get('/activities/:id/entries', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.uid!;
    const query = req.query;

    if (!id) return res.status(400).json({ error: 'MissingParameter', message: 'Activity id is required.' });
    if (!query) return res.status(400).json({ error: 'InvalidQuery', message: 'Query is missing.'});
    
    const parsed = ActivityQuery.safeParse(query);
    if (!parsed.success) return res.status(400).json({ error: 'InvalidQuery', message: 'Query parameters are invalid.', details: parsed.error.issues });
    const entries = await ActivityManager.getActivityEntries(id, parsed.data, user_id);

    if (!entries) {
      return res.status(404).json({ error: 'NotFound', message: `Entries for activity id ${id} not found.` });
    }
    res.json(entries);
  } catch (error) {
    console.error(`Error fetching entries for activity with id ${req.params.id}:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while fetching activity entries.' });
  }
});

// GET /activities/:id - fetch a specific activity
router.get('/activities/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.uid!;

    if (!id) return res.status(400).json({ error: 'MissingParameter', message: 'Activity id is required.' });

    const activity = await ActivityManager.getActivity(id, user_id);
    if (!activity) {
      return res.status(404).json({ error: 'NotFound', message: `Activity with id ${id} not found.` });
    }
    res.json(activity);
  } catch (error) {
    console.error(`Error fetching activity with id ${req.params.id}:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while fetching the activity.' });
  }
});

// PATCH /activities/:id - update a specific activity
router.patch('/activities/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.uid!;
    const body = req.body;

    if (!id) return res.status(400).json({ error: 'MissingParameter', message: 'Activity id is required.' });

    const parsed = PartialActivityWithIds.safeParse({ id, user_id, ...body });
    if (!parsed.success) return res.status(400).json({ error: 'InvalidBody', message: 'Activity Body is invalid.', details: parsed.error.issues });

    const updatedActivity = await ActivityManager.updateActivity({ id, user_id, ...req.body });
    if (!updatedActivity.success) return res.status(updatedActivity.code).json(updatedActivity.details);

    res.json(updatedActivity);
  } catch (error) {
    console.error(`Error updating activity with id ${req.params.id}:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while updating the activity.' });
  }
});

// DELETE /activities/:id - delete a specific activity
router.delete('/activities/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.uid!;

    if (!id) return res.status(400).json({ error: 'MissingParameter', message: 'Activity id is required.' });

    const result = await ActivityManager.deleteActivity(id, user_id);
    if (!result) return res.status(404).json({ error: 'NotFound', message: `Activity with id ${id} not found for deletion.` });
    
    res.json(result);
  } catch (error) {
    console.error(`Error deleting activity with id ${req.params.id}:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while deleting the activity.' });
  }
});

export default router;
