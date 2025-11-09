// src/middleware/auth.ts
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  user_id: string;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader)  return res.status(401).json({ error: 'Missing Authorization header' });

  const token = authHeader.split(' ')[1]; // "Bearer <token>"
  if (!token)       return res.status(401).json({ error: 'Missing token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.uid = payload.user_id; // attach userId to request
    next(); // continue to the next middleware / route handler
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}