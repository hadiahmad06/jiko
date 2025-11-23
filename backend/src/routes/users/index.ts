import { Router } from 'express';

const usersRouter = Router();

// Users API
usersRouter.get('/', (req, res) => {
  res.status(501).json({ error: 'unimplemented' });
});

usersRouter.delete('/', (req, res) => {
  res.status(501).json({ error: 'unimplemented' });
});

export default usersRouter;