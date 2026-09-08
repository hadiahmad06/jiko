import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import UserManager from '../../data/UserManager.js';
import { serverError } from '../../lib/http.js';

const router = Router();

// GET /users - own profile
router.get('/users', authMiddleware, async (req, res) => {
  try {
    const r = await UserManager.getUser(req.uid!);
    if (!r.success) return res.status(404).json({ error: 'NotFound', message: 'User not found' });
    const { password_hash: _p, ...safe } = r.value;
    res.json(safe);
  } catch (err) { serverError(res, err, 'fetching the user'); }
});

// DELETE /users - delete own account and everything under it
router.delete('/users', authMiddleware, async (req, res) => {
  try {
    const ok = await UserManager.deleteUser(req.uid!);
    if (!ok) return res.status(404).json({ error: 'NotFound', message: 'User not found' });
    res.status(204).end();
  } catch (err) { serverError(res, err, 'deleting the user'); }
});

export default router;
