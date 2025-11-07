import { authMiddleware } from '../../middleware/auth.js';
import ActivityManager from '../../data/ActivityManager.js';
import { Router, Request, Response } from 'express';
import { Activity } from '../../types/activity/Activity.js';

const router = Router();

// POST /activities - create a specific activity
router.post('/activities', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;
    const body = req.body;

    const parsed = Activity.safeParse({userId, ...body})
    if (!parsed.success) return res.status(400).json({ error: 'InvalidBody', message: 'Activity Body is invalid.', details: parsed.error.issues });

    const newActivity = await ActivityManager.createActivity(parsed.data);
    if (!newActivity) { return res.status(404).json({ error: 'NotFound', message: `Could not create activity` }); }

    res.json(newActivity);
  } catch (error) {
    console.error(`Error creating activity with id ${req.params.id}:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while creating the activity.' });
  }
});

// GET /activities - gets all activities owned by the user
router.get('/activities', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId!;

    const activities = await ActivityManager.getActivities(userId);
    if (!activities) { return res.status(404).json({ error: 'NotFound', message: `Could not fetch any activities owned by the user` }); }

    res.json(activities);
  } catch (error) {
    console.error(`Error fetching activities for user:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while fetching activities owned by the user.' });
  }
});

export default router;
