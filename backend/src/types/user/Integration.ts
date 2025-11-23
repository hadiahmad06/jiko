import { z } from 'zod';

// INTEGRATIONS table schema
export const Integration = z.object({
  user_id: z.uuid(),
  service_id: z.uuid(),
  access_token: z.string(),
  refresh_token: z.string(),
  last_synced: z.coerce.date(),
  intervention_level: z.float64(),
  sync_settings: z.json()
});