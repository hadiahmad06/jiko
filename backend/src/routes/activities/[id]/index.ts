import { authMiddleware } from '../../../middleware/auth.js';
import ActivityManager from '../../../data/ActivityManager.js';
import { Router, Request, Response } from 'express';
import { PartialActivityWithIds } from '../../../services/ActivityRepository.js';

const router = Router();

// GET /activities/:id - fetch a specific activity
router.get('/activities/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    if (!id) return res.status(400).json({ error: 'MissingParameter', message: 'Activity id is required.' });

    const activity = await ActivityManager.getActivity(id, userId);
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
    const userId = req.userId!;
    const body = req.body;

    if (!id) return res.status(400).json({ error: 'MissingParameter', message: 'Activity id is required.' });

    const parsed = PartialActivityWithIds.safeParse({ id, userId, ...body });
    if (!parsed.success) return res.status(400).json({ error: 'InvalidBody', message: 'Activity Body is invalid.', details: parsed.error.issues });

    const updatedActivity = await ActivityManager.updateActivity({ id, userId, ...req.body });
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
    const userId = req.userId!;

    if (!id) return res.status(400).json({ error: 'MissingParameter', message: 'Activity id is required.' });

    const result = await ActivityManager.deleteActivity(id, userId);
    if (!result) return res.status(404).json({ error: 'NotFound', message: `Activity with id ${id} not found for deletion.` });
    
    res.json(result);
  } catch (error) {
    console.error(`Error deleting activity with id ${req.params.id}:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while deleting the activity.' });
  }
});

export default router;
