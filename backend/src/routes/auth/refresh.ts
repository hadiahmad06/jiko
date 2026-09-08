// src/routes/auth/refresh.ts
import { Router } from 'express';
import { secretsConfigured, signAccessToken, verifyRefreshToken } from '../../lib/jwt.js';

const router = Router();

// POST /auth/refresh  { refreshToken } -> { token }
router.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(400).json({ error: 'Missing refresh token' });
  }

  if (!secretsConfigured()) {
    console.error('JWT secrets missing');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const user_id = verifyRefreshToken(refreshToken);
  if (!user_id) return res.status(401).json({ error: 'Invalid or expired refresh token' });

  return res.json({ token: signAccessToken(user_id) });
});

export default router;
