import { Router } from 'express';
import UserManager from '../../UserManager.js';
import jwt from 'jsonwebtoken';

const router = Router();

router.get('/', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    // Verify JWT
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET missing");
      return res.status(500).json({ error: 'Server misconfiguration' });
    }
    const payload = jwt.verify(token, secret) as { userId: string };

    const user = await UserManager.getUser(payload.userId);

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      phoneNumber: user.phoneNumber,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      nickname: user.nickname,
    });
  } catch (err) {
    console.error('Fetch user error:', err);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export default router;