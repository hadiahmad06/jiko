import { z } from "zod";

// OBLIGATIONS table schema
export const Obligation = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  title: z.string(),
  description: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});

