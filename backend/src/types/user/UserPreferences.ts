// src/types/user/UserPreferences.ts
import { z } from "zod";

const HHMM = z.string().regex(/^\d{2}:\d{2}$/);

export const Voice = z.enum(["older_sibling", "drill_sergeant", "dry_coworker", "gentle", "own_voice"]);
export type VoiceT = z.infer<typeof Voice>;

export const DeliveryChannel = z.enum(["agent", "imessage", "sms", "webhook", "console"]);
export type DeliveryChannelT = z.infer<typeof DeliveryChannel>;

export const UserPreferences = z.object({
  user_id: z.uuid(),
  timezone: z.string().default("UTC"),
  language: z.string().default("en"),
  // 0 = gentle, 1 = ruthless. Sets the default interrupt budget and message tone.
  strictness: z.number().min(0).max(1).default(0.5),
  interrupt_budget_per_day: z.number().int().min(0).default(4),
  quiet_hours: z.object({ start: HHMM, end: HHMM }).default({ start: "23:00", end: "08:00" }),
  voice: Voice.default("older_sibling"),
  // Style instructions for `voice = own_voice`, produced from the user's own
  // texts by training/processing/style_guide.py. Style only, never content.
  voice_guide: z.string().max(4000).nullable().default(null),
  delivery_channel: DeliveryChannel.default("agent"),
  updated_at: z.coerce.date().optional(),
});
export type UserPreferencesT = z.infer<typeof UserPreferences>;

export const UserPreferencesUpdate = UserPreferences.omit({ user_id: true, updated_at: true }).partial().strict();
export type UserPreferencesUpdateT = z.infer<typeof UserPreferencesUpdate>;

/** Budget implied by a strictness level when the user hasn't set one explicitly. */
export function budgetForStrictness(s: number): number {
  if (s < 0.2) return 1;
  if (s < 0.4) return 2;
  if (s < 0.6) return 4;
  if (s < 0.8) return 6;
  return 10;
}
