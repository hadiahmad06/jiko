import { z } from "zod";

// CHATBOT_SPEAKING_STYLE_WEIGHTS table schema
export const ChatbotSpeakingStyleWeight = z.object({
  id: z.uuid(),
  chatbot_id: z.uuid(),
  speaking_style_id: z.uuid(),
  weight: z.number(),
  created_at: z.date(),
  updated_at: z.date(),
});
