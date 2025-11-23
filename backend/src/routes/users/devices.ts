import { Router } from 'express';

const devicesRouter = Router();

// Devices API
devicesRouter.get('/', (req, res) => {
  res.status(501).json({ error: 'unimplemented' });
});

devicesRouter.post('/', (req, res) => {
  res.status(501).json({ error: 'unimplemented' });
});

devicesRouter.get('/:id', (req, res) => {
  res.status(501).json({ error: 'unimplemented' });
});

devicesRouter.patch('/:id', (req, res) => {
  res.status(501).json({ error: 'unimplemented' });
});

devicesRouter.delete('/:id', (req, res) => {
  res.status(501).json({ error: 'unimplemented' });
});

export default devicesRouter;