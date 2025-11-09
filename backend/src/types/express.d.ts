// src/types/express.d.ts
import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    uid?: string; // add the user_id property
  }
}