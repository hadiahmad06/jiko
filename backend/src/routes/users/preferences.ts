import { Router } from 'express';

const preferencesRouter = Router();

// User Preferences API
preferencesRouter.get('/', (req, res) => {
  res.status(501).json({ error: 'unimplemented' });
});

preferencesRouter.patch('/', (req, res) => {
  res.status(501).json({ error: 'unimplemented' });
});

preferencesRouter.delete('/', (req, res) => {
  res.status(501).json({ error: 'unimplemented' });
});

export default preferencesRouter;