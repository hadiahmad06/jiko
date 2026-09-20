#!/usr/bin/env bash
# Restore a dump into a database, and prove it worked.
#
#   ./scripts/restore.sh backups/jiko-20260919T040000Z.dump postgres://.../jiko_restore_test
#
# The target must NOT be the production database: this drops and recreates
# every object it restores. The script refuses a target whose name has no
# marker of being a scratch database unless RESTORE_I_MEAN_IT=yes.
set -euo pipefail

DUMP="${1:?usage: restore.sh <dump file> <target DATABASE_URL>}"
TARGET="${2:?usage: restore.sh <dump file> <target DATABASE_URL>}"

if [[ "$TARGET" != *restore* && "$TARGET" != *test* && "$TARGET" != *scratch* && "${RESTORE_I_MEAN_IT:-}" != "yes" ]]; then
  echo "[restore] refusing: '$TARGET' does not look like a scratch database."
  echo "[restore] set RESTORE_I_MEAN_IT=yes if you really mean it."
  exit 2
fi

echo "[restore] restoring $DUMP into $TARGET"
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$TARGET" "$DUMP"

echo "[restore] verifying"
psql "$TARGET" -v ON_ERROR_STOP=1 -At <<'SQL'
SELECT 'tables=' || COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
SELECT 'users=' || COUNT(*) FROM users;
SELECT 'messages=' || COUNT(*) FROM messages;
SELECT 'triggers=' || COUNT(*) FROM triggers;
SELECT 'migrations=' || COUNT(*) FROM schema_migrations;
SQL
echo "[restore] ok"
