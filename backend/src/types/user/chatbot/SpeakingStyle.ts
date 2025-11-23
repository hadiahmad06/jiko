import { z } from "zod";

// SPEAKING_STYLES table schema
export const SpeakingStyle = z.object({
  id: z.uuid(),
  style_name: z.string(),
  description: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});
