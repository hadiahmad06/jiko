-- 0004_quiet_mode.sql
-- Device-reported quiet windows: a macOS Focus, or the user hitting pause.
-- Leased, not permanent: the device renews it, so a crashed agent cannot
-- silence Jiko forever.

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS quiet_until  TIMESTAMPTZ;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS quiet_reason TEXT;
