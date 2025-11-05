// src/routes/auth/refresh.ts

import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();
// POST /auth/refresh
router.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing refresh token' });
  }

  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  const accessSecret = process.env.JWT_SECRET;
  if (!refreshSecret || !accessSecret) {
    console.error("JWT secrets missing");
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  try {
    const decoded = jwt.verify(refreshToken, refreshSecret) as { userId: string };
    const newAccessToken = jwt.sign({ userId: decoded.userId }, accessSecret, { expiresIn: '1d' });

    res.json({ token: newAccessToken });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

export default router;