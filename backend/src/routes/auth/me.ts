import { Router } from 'express';
import UserManager from '../../data/UserManager.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = Router();

// GET /auth/me - the caller's own profile (never returns password_hash)
router.get('/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await UserManager.getUser(req.uid!);
    if (!result.success) return res.status(404).json({ error: 'User not found' });
    const user = result.value;
    return res.json({
      id: user.id,
      phoneNumber: user.phone_number,
      email: user.email,
      username: user.username,
      displayName: user.display_name,
      nickname: user.nickname,
    });
  } catch (err) {
    console.error('Fetch user error:', err);
    return res.status(500).json({ error: 'ServerError', message: 'An unexpected error occurred' });
  }
});

export default router;
