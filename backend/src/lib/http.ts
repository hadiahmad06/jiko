// src/lib/http.ts
// Route helpers so every handler validates and fails the same way.
import { Response } from 'express';
import { ZodType } from 'zod';
import { Result } from '../types/common/common.js';

export function parseOr400<T>(res: Response, schema: ZodType<T>, input: unknown, what = 'Body'): T | null {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  res.status(400).json({ error: 'InvalidBody', message: `${what} is invalid.`, details: parsed.error.issues });
  return null;
}

export function sendResult<T>(res: Response, result: Result<T>, status = 200) {
  if (!result.success) return res.status(result.code).json(result.details);
  return res.status(status).json(result.value);
}

export function serverError(res: Response, err: unknown, what: string) {
  console.error(`[${what}]`, err);
  return res.status(500).json({ error: 'ServerError', message: `An unexpected error occurred while ${what}.` });
}
