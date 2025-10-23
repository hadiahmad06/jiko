// src/routes/auth.ts
import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

router.post('/login', (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  const token = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' });

  res.json({ token });
});

export default router;