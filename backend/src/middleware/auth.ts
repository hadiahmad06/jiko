// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { bearerToken, verifyAccessToken } from '../lib/jwt.js';

/**
 * Requires a valid access token. On success sets `req.uid` to the user's id.
 * Error bodies are intentionally stable; clients and tests match on `error`.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

  const token = bearerToken(authHeader);
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const user_id = verifyAccessToken(token);
  if (!user_id) return res.status(401).json({ error: 'Invalid or expired token' });

  req.uid = user_id;
  next();
}
