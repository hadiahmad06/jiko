-- 0003_voice_guide.sql
-- The `own_voice` style guide produced by training/processing/style_guide.py.
-- Style instructions only; no messages are stored here.

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS voice_guide TEXT;
