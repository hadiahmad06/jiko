// src/routes/auth.ts
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import UserManager from '../../UserManager.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    // Fetch the user from UserManager
    const user = await UserManager.getUser(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate JWT
    const token = jwt.sign({ userId: user.uuid }, process.env.JWT_SECRET!, { expiresIn: '1d' });
    res.json({ 
      token, 
      phoneNumber: user.phoneNumber,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      nickname: user.nickname,
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;