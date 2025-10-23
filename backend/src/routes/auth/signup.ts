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
    // 1️⃣ Validate input with Zod
    const { phoneNumber } = UserSchema.pick({ phoneNumber: true }).parse(req.body);
    const { password, email, username, displayName, nickname } = req.body;
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // 2️⃣ Generate uuid for user
    const uuid = crypto.randomUUID();

    // 3️⃣ Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 4️⃣ Create user object
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

    // 5️⃣ Save user in UserManager
    const { success, message } = await UserManager.addUser(newUser);
    if (!success) {
      return res.status(500).json({ error: message || 'Failed to create user' });
    }

    // 6️⃣ Create JWT
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