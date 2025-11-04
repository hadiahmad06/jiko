import { Router, Request, Response } from 'express';

const router = Router();

// GET /activities - fetch all activities (common)
router.get('/', async (req: Request, res: Response) => {
  // TODO: implement fetching activities (consider caching)
  res.json({ message: 'GET /activities endpoint' });
});

// POST /activities - create a new activity
router.post('/', async (req: Request, res: Response) => {
  // TODO: implement activity creation
  res.json({ message: 'POST /activities endpoint' });
});

export default router;
