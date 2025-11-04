import { Router, Request, Response } from 'express';

const router = Router();

// GET /activities/:id - fetch a specific activity
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  // TODO: implement fetching activity by id
  res.json({ message: `GET /activities/${id} endpoint` });
});

// PUT /activities/:id - update a specific activity
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  // TODO: implement updating activity by id
  res.json({ message: `PUT /activities/${id} endpoint` });
});

// DELETE /activities/:id - delete a specific activity
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  // TODO: implement deleting activity by id
  res.json({ message: `DELETE /activities/${id} endpoint` });
});

export default router;