// src/routes/auth.ts
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { type UserLookup } from '../../services/UserRepository.js';
import UserManager from '../../data/UserManager.js';

const router = Router();

// POST /auth/login
router.post('/auth/login', async (req, res) => {
  const { id, username, email, phone_number, password, otp } = req.body;

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
    if (id) lookup.id = id;
    else if (phone_number) lookup.phone_number = phone_number;
    else if (username) lookup.username = username;
    else if (email) lookup.email = email;
    else {
      return res.status(400).json({ error: 'No user identifier provided.' });
    }
    // Flexible getUser call
    const result = await UserManager.getUser(lookup);
    // console.log(result)
    if (!result.success) return res.status(404).json({ error: 'User not found' });
    const user = result.value

    // Compare password with hashed password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT and refresh token
    const secret = process.env.JWT_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!secret || !refreshSecret) {
      console.error("JWT secrets missing");
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    const token = jwt.sign({ user_id: user.id }, secret, { expiresIn: '1d' });
    const refreshToken = jwt.sign({ user_id: user.id }, refreshSecret, { expiresIn: '7d' });

    res.json({
      token,
      refreshToken,
      phone_number: user.phone_number,
      email: user.email,
      username: user.username,
      display_name: user.display_name,
      nickname: user.nickname,
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;