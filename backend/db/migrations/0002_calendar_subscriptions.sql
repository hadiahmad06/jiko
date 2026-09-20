-- 0002_calendar_subscriptions.sql
-- A stored ICS URL per user, re-imported on a schedule. Canvas, Google
-- Calendar and Apple Calendar all publish one, which covers most students
-- without an OAuth integration.

CREATE TABLE IF NOT EXISTS calendar_subscriptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url              TEXT NOT NULL,
  name             TEXT,
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  -- How far ahead to import. Past events are never useful to Jiko.
  window_days      INT NOT NULL DEFAULT 30 CHECK (window_days BETWEEN 1 AND 365),
  refresh_hours    INT NOT NULL DEFAULT 24 CHECK (refresh_hours BETWEEN 1 AND 168),
  last_imported_at TIMESTAMPTZ,
  last_status      TEXT,          -- 'ok' | 'error'
  last_error       TEXT,
  last_created     INT NOT NULL DEFAULT 0,
  last_updated     INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, url)
);

CREATE INDEX IF NOT EXISTS calendar_subscriptions_due_idx
  ON calendar_subscriptions (enabled, last_imported_at);

DROP TRIGGER IF EXISTS calendar_subscriptions_set_updated_at ON calendar_subscriptions;
CREATE TRIGGER calendar_subscriptions_set_updated_at BEFORE UPDATE ON calendar_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
