-- 0005_integrations.sql
-- Connected accounts: Google (Gmail + Calendar over OAuth) and Canvas (a
-- personal access token). One row per user and provider. Credentials are
-- sealed with JIKO_TOKEN_KEY before they reach this table (src/lib/secretBox.ts);
-- a database dump alone does not hand out anyone's mailbox.

CREATE TABLE IF NOT EXISTS integrations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider           TEXT NOT NULL CHECK (provider IN ('google', 'canvas')),
  -- Who the account is, for display: the Google address, the Canvas name.
  account            TEXT,
  -- Canvas instance origin (https://school.instructure.com). Null for Google.
  base_url           TEXT,
  scopes             TEXT[] NOT NULL DEFAULT '{}',
  -- Sealed JSON: Google {refresh_token}, Canvas {token}.
  secret_enc         TEXT NOT NULL,
  -- Sealed short-lived Google access token, so a sync does not refresh every time.
  access_token_enc   TEXT,
  access_expires_at  TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'needs_reauth', 'error')),
  enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  refresh_minutes    INT NOT NULL DEFAULT 30 CHECK (refresh_minutes BETWEEN 5 AND 1440),
  -- Provider-specific progress, e.g. {"gmail_after": 1730000000}.
  cursor             JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at     TIMESTAMPTZ,
  last_status        TEXT,          -- 'ok' | 'partial' | 'error'
  last_error         TEXT,
  last_created       INT NOT NULL DEFAULT 0,
  last_updated       INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS integrations_due_idx ON integrations (enabled, status, last_synced_at);

DROP TRIGGER IF EXISTS integrations_set_updated_at ON integrations;
CREATE TRIGGER integrations_set_updated_at BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
