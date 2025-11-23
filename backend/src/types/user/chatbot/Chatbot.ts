import { z } from "zod";

// CHATBOTS table schema
export const Chatbot = z.object({
  id: z.uuid(),
  user_preference_id: z.uuid(),
  chatbot_name: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});
