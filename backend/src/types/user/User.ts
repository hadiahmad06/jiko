import { z } from 'zod';

// USERS table schema
// TODO: verify that nullable and optional modifiers are valid
export const User = z.object({
  id: z.string(),
  phone_number: z.string(),
  password_hash: z.string(),
  email: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  created_at: z.coerce.string().nullable().optional(),
  updated_at: z.coerce.string().nullable().optional(),
  display_name: z.string().nullable().optional(),
  nickname: z.string().nullable().optional(),
});
// * user data will be kept separate and will instead be queried using shared id. 
// * this will also be MUCH easier for caching later on


export type UserT = z.infer<typeof User>;
