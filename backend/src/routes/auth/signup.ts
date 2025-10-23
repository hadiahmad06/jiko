// src/routes/auth/signup.ts
import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { UserSchema, type User } from '../../types/User.js';
import UserManager from '../../UserManager.js';

const router = express.Router();
const SALT_ROUNDS = 12;

// POST /signup
router.post('/', async (req, res) => {
  try {
    // 1 Validate inputs
    const { phoneNumber, password, email, username, displayName, nickname, otp } = req.body;
    if (!phoneNumber || typeof phoneNumber !== 'string') {
        return res.status(400).json({ error: 'No phone number provided'})
    }
    if (password && (typeof password !== 'string' || password.length < 8)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    } else if (otp) {
      // TODO: Validate OTP here
      return res.status(500).json({ error: 'OTP validation not implemented' });
    }

    // 2 Generate uuid for user
    const uuid = crypto.randomUUID();

    // 3 Hash password
    const passwordHash = password ? await bcrypt.hash(password, SALT_ROUNDS) : undefined;

    // 4 Create user object
    const newUser: User = UserSchema.parse({
      uuid,
      phoneNumber,
      email,
      username,
      passwordHash,  // store hashed password, never plaintext
      displayName,
      nickname,
      appUsage: {},  // start empty
    });

    // 5 Save user in UserManager
    const { success, message } = await UserManager.addUser(newUser);
    if (!success) {
      return res.status(500).json({ error: message || 'Failed to create user' });
    }

    // 6 Create JWT
    const token = jwt.sign(
      { userId: uuid },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    res.status(201).json({
      message: 'User created',
      userId: uuid,
      token,
    });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

export default router;