import { Router, Request, Response } from 'express';

const router = Router();

// POST /activities/:id/entries - create a new entry for a specific activity (main write path)
router.post('/', async (req: Request, res: Response) => {
  const { id } = req.params;
  // TODO: implement adding entry to activity with id
  res.json({ message: `POST /activities/${id}/entries endpoint` });
});

export default router;