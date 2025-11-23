import { Router } from 'express';

const integrationsRouter = Router();

// Integrations API
integrationsRouter.get('/', (req, res) => {
  res.status(501).json({ error: 'unimplemented' });
});

integrationsRouter.post('/', (req, res) => {
  res.status(501).json({ error: 'unimplemented' });
});

integrationsRouter.get('/:id', (req, res) => {
  res.status(501).json({ error: 'unimplemented' });
});

integrationsRouter.patch('/:id', (req, res) => {
  res.status(501).json({ error: 'unimplemented' });
});

integrationsRouter.delete('/:id', (req, res) => {
  res.status(501).json({ error: 'unimplemented' });
});

integrationsRouter.patch('/:id/sync', (req, res) => {
  res.status(501).json({ error: 'unimplemented' });
});

export default integrationsRouter;