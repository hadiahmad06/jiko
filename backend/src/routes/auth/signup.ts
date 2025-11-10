// src/routes/auth/signup.ts
import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { User, type UserT } from '../../types/user/User.js';
import UserManager from '../../data/UserManager.js';

const router = express.Router();
const SALT_ROUNDS = 12;

// POST /auth/signup
router.post('/auth/signup', async (req, res) => {
  try {
    // 1 Validate inputs
    const { phone_number, password, email, username, display_name, nickname, otp } = req.body;
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_+=\[\]{}|;:'",.<>/?]).{8,}$/;
    
    if (!phone_number || typeof phone_number !== 'string') {
        return res.status(400).json({ error: 'No phone number provided'})
    }
    if (!password && !otp) {
      return res.status(400).json({ error: 'Neither password nor OTP were provided.'})
    } else if (password && (typeof password !== 'string' || !passwordRegex.test(password))) {
      return res.status(400).json({ error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character' });
    } else if (otp) {
      // TODO: Validate OTP here
      return res.status(500).json({ error: 'OTP validation not implemented' });
    }

    // 2 Generate uuid for user
    const id = crypto.randomUUID();

    // 3 Hash password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // 4 Create user object
    const newUser: UserT = User.parse({
      id,
      phone_number,
      email,
      username,
      password_hash,  // store hashed password, never plaintext
      display_name,
      nickname,
      appUsage: {},  // start empty
    });

    // 5 Save user in UserManager
    const result = await UserManager.addUser(newUser);
    // console.log("signup route: ", result)
    if (!result.success) {
      return res.status(result.code).json(result.details);
    }

    // 6 Create JWT and refresh token
    const secret = process.env.JWT_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!secret || !refreshSecret) {
      console.error("JWT secrets missing");
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

    const token = jwt.sign({ userId: id }, secret, { expiresIn: '1d' });
    const refreshToken = jwt.sign({ userId: id }, refreshSecret, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User created',
      user_id: id,
      token,
      refreshToken
    });

  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

export default router;