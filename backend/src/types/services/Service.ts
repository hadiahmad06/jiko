import { z } from "zod";

// SERVICES table schema
export const Service = z.object({
  id: z.uuid(),
  service_name: z.string(),
  service_description: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});