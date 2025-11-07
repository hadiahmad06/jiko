import ActivityManager from '../../../data/ActivityManager.js';
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../../middleware/auth.js';
import { ActivityQuery } from 'services/ActivityRepository.js';

const router = Router();

/**
 * @swagger
 * /activities/{id}/entries:
 *   get:
 *     summary: Fetch activity entries
 *     description: Retrieve entries for a specific activity by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the activity
 *         schema:
 *           type: string
 *       - in: header
 *         name: userId
 *         description: ID of the authenticated user
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activity entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *       400:
 *         description: Missing parameters
 *       404:
 *         description: Entries not found
 *       500:
 *         description: Server error
 */
router.get('/activities/:id/entries', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!id) {
      return res.status(400).json({ error: 'MissingParameter', message: 'Activity id is required.' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'MissingParameter', message: 'User id is required.' });
    }

    const query = req.body as ActivityQuery;
    const entries = await ActivityManager.getActivityEntries(id, query, userId);
    if (!entries) {
      return res.status(404).json({ error: 'NotFound', message: `Entries for activity id ${id} not found.` });
    }
    res.json(entries);
  } catch (error) {
    console.error(`Error fetching entries for activity with id ${req.params.id}:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while fetching activity entries.' });
  }
});

/**
 * @swagger
 * /activities/{id}/entries:
 *   post:
 *     summary: Create activity entry
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Activity entry data
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Created entry
 *       404:
 *         description: Could not create entry
 */
router.post('/activities/:id/entries', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!id) { return res.status(400).json({ error: 'MissingParameter', message: 'Activity id is required.' }); }
    if (!userId) { return res.status(400).json({ error: 'MissingParameter', message: 'User id is required.' }); }

    const newEntry = await ActivityManager.addEntry({ activityId: id, userId, ...req.body });

    if (!newEntry) { return res.status(404).json({ error: 'NotFound', message: `Could not create entry for activity id ${id}.` }); }
    res.json(newEntry);
  } catch (error) {
    console.error(`Error creating entry for activity with id ${req.params.id}:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while creating activity entry.' });
  }
});

/**
 * @swagger
 * /activities/{id}/entries:
 *   delete:
 *     summary: Delete entry
 *     parameters:`
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deletion result
 *       404:
 *         description: Entry not found
 */
router.delete('/activities/:id/entries', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!id) { return res.status(400).json({ error: 'MissingParameter', message: 'Activity id is required.' }); }
    if (!userId) { return res.status(400).json({ error: 'MissingParameter', message: 'User id is required.' }); }

    const result = await ActivityManager.deleteActivityEntry(id, userId);
    if (!result) { return res.status(404).json({ error: 'NotFound', message: `Activity Entry with id ${id} not found for deletion.` }); }
    res.json(result);
  } catch (error) {
    console.error(`Error deleting activity entry with id ${req.params.id}:`, error);
    res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred while deleting the activity entry.' });
  }
});

export default router;