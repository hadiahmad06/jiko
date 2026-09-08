-- 0001_baseline.sql
-- Jiko schema baseline. Postgres 15 + PostGIS.
-- Every table that the API reads or writes lives here. See backend/docs/data-model.md.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TYPE log_type AS ENUM ('user', 'system', 'trigger');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE obligation_kind AS ENUM ('task', 'event', 'goal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE trigger_kind AS ENUM ('app_usage', 'location', 'scheduled', 'health', 'obligation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE message_direction AS ENUM ('outbound', 'inbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE message_status AS ENUM ('queued', 'sent', 'delivered', 'failed', 'received');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platform AS ENUM ('ios', 'macos', 'windows', 'android', 'linux', 'web');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY,
  phone_number  TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email         TEXT UNIQUE,
  username      TEXT UNIQUE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  display_name  TEXT,
  nickname      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One row per user. Created lazily with defaults on first read.
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id                  UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  timezone                 TEXT NOT NULL DEFAULT 'UTC',
  language                 TEXT NOT NULL DEFAULT 'en',
  strictness               REAL NOT NULL DEFAULT 0.5 CHECK (strictness >= 0 AND strictness <= 1),
  interrupt_budget_per_day INT  NOT NULL DEFAULT 4 CHECK (interrupt_budget_per_day >= 0),
  quiet_hours              JSONB NOT NULL DEFAULT '{"start":"23:00","end":"08:00"}',
  voice                    TEXT NOT NULL DEFAULT 'older_sibling',
  delivery_channel         TEXT NOT NULL DEFAULT 'agent',
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS user_preferences_set_updated_at ON user_preferences;
CREATE TRIGGER user_preferences_set_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS devices (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform     platform NOT NULL,
  name         TEXT,
  push_token   TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS devices_user_id_idx ON devices(user_id);
DROP TRIGGER IF EXISTS devices_set_updated_at ON devices;
CREATE TRIGGER devices_set_updated_at BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Activities: the positive side. "Building Jiko", "Gym", "Reading".
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activities (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  image       TEXT,
  color       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activities_user_id_idx ON activities(user_id);
DROP TRIGGER IF EXISTS activities_set_updated_at ON activities;
CREATE TRIGGER activities_set_updated_at BEFORE UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS activity_entries (
  id               UUID PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id      UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ,
  note             TEXT,
  logged_by        log_type NOT NULL,
  ended_by         log_type,
  confidence_score REAL,
  duration_minutes INT GENERATED ALWAYS AS (CAST(EXTRACT(EPOCH FROM (end_time - start_time)) / 60 AS INT)) STORED,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activity_entries_user_start_idx ON activity_entries(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS activity_entries_open_idx ON activity_entries(user_id, activity_id) WHERE end_time IS NULL;
DROP TRIGGER IF EXISTS activity_entries_set_updated_at ON activity_entries;
CREATE TRIGGER activity_entries_set_updated_at BEFORE UPDATE ON activity_entries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Locations: named geofences. geog is derived from lat/long by trigger.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  latitude   DOUBLE PRECISION NOT NULL,
  longitude  DOUBLE PRECISION NOT NULL,
  radius_m   INT NOT NULL CHECK (radius_m > 0),
  geog       GEOGRAPHY(POINT, 4326),
  archived   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS locations_user_id_idx ON locations(user_id);
CREATE INDEX IF NOT EXISTS locations_geog_idx ON locations USING GIST (geog);
CREATE OR REPLACE FUNCTION locations_update_geog() RETURNS TRIGGER AS $$
BEGIN
  NEW.geog := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS locations_update_geog ON locations;
CREATE TRIGGER locations_update_geog BEFORE INSERT OR UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION locations_update_geog();
DROP TRIGGER IF EXISTS locations_set_updated_at ON locations;
CREATE TRIGGER locations_set_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Obligations: the "why" behind an interruption. One table, three kinds.
--   task:  has due_at
--   event: has start_at / end_at (optionally location_id)
--   goal:  recurring time target (target_minutes per timeframe_days) for an activity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS obligations (
  id                 UUID PRIMARY KEY,
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind               obligation_kind NOT NULL,
  title              TEXT NOT NULL,
  description        TEXT,
  due_at             TIMESTAMPTZ,
  start_at           TIMESTAMPTZ,
  end_at             TIMESTAMPTZ,
  all_day            BOOLEAN NOT NULL DEFAULT FALSE,
  location_id        UUID REFERENCES locations(id) ON DELETE SET NULL,
  activity_id        UUID REFERENCES activities(id) ON DELETE SET NULL,
  target_minutes     INT,
  timeframe_days     INT,
  intervention_level REAL NOT NULL DEFAULT 0.5 CHECK (intervention_level >= 0 AND intervention_level <= 1),
  completed          BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at       TIMESTAMPTZ,
  archived           BOOLEAN NOT NULL DEFAULT FALSE,
  source             TEXT NOT NULL DEFAULT 'user',
  external_ref       TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS obligations_user_due_idx ON obligations(user_id, due_at) WHERE NOT completed AND NOT archived;
CREATE INDEX IF NOT EXISTS obligations_user_start_idx ON obligations(user_id, start_at) WHERE NOT archived;
DROP TRIGGER IF EXISTS obligations_set_updated_at ON obligations;
CREATE TRIGGER obligations_set_updated_at BEFORE UPDATE ON obligations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Triggers: "when X (kind + match) and Y (condition), do Z (actions)".
--   match     kind-specific matcher, e.g. {"bundle_ids":["com.instagram"],"min_minutes":30}
--   condition Condition JSON (types/json/Condition.ts); true means always
--   actions   Action[] JSON  (types/json/Action.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS triggers (
  id               UUID PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind             trigger_kind NOT NULL,
  name             TEXT NOT NULL,
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  match            JSONB NOT NULL DEFAULT '{}',
  condition        JSONB NOT NULL DEFAULT 'true',
  actions          JSONB NOT NULL DEFAULT '[]',
  cooldown_seconds INT NOT NULL DEFAULT 0 CHECK (cooldown_seconds >= 0),
  next_run_at      TIMESTAMPTZ,
  last_fired_at    TIMESTAMPTZ,
  fire_count       INT NOT NULL DEFAULT 0,
  source           TEXT NOT NULL DEFAULT 'user',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS triggers_user_kind_idx ON triggers(user_id, kind) WHERE enabled;
CREATE INDEX IF NOT EXISTS triggers_scheduled_due_idx ON triggers(next_run_at) WHERE enabled AND kind = 'scheduled';
DROP TRIGGER IF EXISTS triggers_set_updated_at ON triggers;
CREATE TRIGGER triggers_set_updated_at BEFORE UPDATE ON triggers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Audit log of every firing. Drives cooldowns, quotas, and "Jiko noticed" history.
CREATE TABLE IF NOT EXISTS trigger_firings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fired_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context    JSONB NOT NULL DEFAULT '{}',
  results    JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS trigger_firings_trigger_idx ON trigger_firings(trigger_id, fired_at DESC);
CREATE INDEX IF NOT EXISTS trigger_firings_user_idx ON trigger_firings(user_id, fired_at DESC);

-- ---------------------------------------------------------------------------
-- Messages: the conversation. Outbound = Jiko -> user, inbound = user -> Jiko.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction    message_direction NOT NULL,
  channel      TEXT NOT NULL DEFAULT 'agent',
  body         TEXT NOT NULL,
  status       message_status NOT NULL DEFAULT 'queued',
  trigger_id   UUID REFERENCES triggers(id) ON DELETE SET NULL,
  reply_to_id  UUID REFERENCES messages(id) ON DELETE SET NULL,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at      TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS messages_user_created_idx ON messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_queued_idx ON messages(user_id, created_at) WHERE status = 'queued';

-- ---------------------------------------------------------------------------
-- Usage aggregates: what actually gets summarized back to the user.
-- Raw sync payloads stay in memory (see AppUsageManager); this is the durable rollup.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_usage_daily (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day        DATE NOT NULL,
  device_id  TEXT NOT NULL,
  bundle_id  TEXT NOT NULL,
  app_name   TEXT,
  category   TEXT,
  seconds    INT NOT NULL DEFAULT 0,
  opens      INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, day, device_id, bundle_id)
);

-- Per-user app labels: is this app "distracting", "work", "neutral"? Feeds summaries and conditions.
CREATE TABLE IF NOT EXISTS app_labels (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bundle_id  TEXT NOT NULL,
  label      TEXT NOT NULL CHECK (label IN ('distracting', 'work', 'neutral')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, bundle_id)
);

-- Seen-app catalogue so the client can offer labels for apps the user actually uses.
CREATE TABLE IF NOT EXISTS seen_apps (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bundle_id    TEXT NOT NULL,
  app_name     TEXT,
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, bundle_id)
);
