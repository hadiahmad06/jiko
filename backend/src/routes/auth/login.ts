// src/routes/auth.ts
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import UserManager from '../../UserManager.js';
import type { UserLookup } from '../../UserManager.js';

const router = Router();

router.post('/', async (req, res) => {
  const { userId, username, email, phoneNumber, password, otp } = req.body;

  if (!password && !otp) {
    return res.status(400).json({ error: 'Missing password and otp' });
  }

  if (otp) {
    return res.status(500).json({ error: 'OTP login not implemented' });
  }

  // Otherwise proceed with password-based login
  try {
    // Determine lookup criteria
    const lookup: UserLookup = {};
    if (username) lookup.username = username;
    if (email) lookup.email = email;
    if (phoneNumber) lookup.phoneNumber = phoneNumber;
    if (userId) lookup.userId = userId;

    // Flexible getUser call
    const user = await UserManager.getUser(lookup);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Compare password with hashed password
    const valid = await bcrypt.compare(password, user.passwordHash!);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET missing");
      return res.status(500).json({ error: 'Server misconfiguration' });
    }
    const token = jwt.sign({ userId: user.uuid }, secret, { expiresIn: '1d' });

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