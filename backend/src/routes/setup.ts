// src/routes/setup.ts
//
// The web setup page: create an account, connect Google and Canvas, pick a
// strictness, then install the apps. Plain static files from backend/public;
// the page talks to the same JSON API the apps use.
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';

const router = Router();
// src/routes (tsx) and dist/routes (built) are both two levels below backend/
const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
const FILES: Record<string, string> = { 'setup.js': 'application/javascript', 'setup.css': 'text/css' };

router.get('/', (_req, res) => res.redirect('/setup'));

router.get('/setup', (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(PUBLIC, 'setup.html'));
});

router.get('/setup/:file', (req, res) => {
  const type = FILES[req.params.file as string];
  if (!type) return res.status(404).json({ error: 'NotFound', message: 'Not found' });
  res.set('Cache-Control', 'no-cache').type(type).sendFile(path.join(PUBLIC, req.params.file as string));
});

export default router;
