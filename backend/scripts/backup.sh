#!/usr/bin/env bash
# Nightly logical backup. Writes one compressed custom-format dump, prunes old
# ones, and (when S3_BUCKET is set) uploads it.
#
#   DATABASE_URL=postgres://... ./scripts/backup.sh [outdir]
#
# Custom format (-Fc), not plain SQL: it restores selectively and in parallel,
# and pg_restore can list what is inside without applying it.
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL}"
OUT_DIR="${1:-${BACKUP_DIR:-./backups}}"
KEEP="${BACKUP_KEEP:-14}"

mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/jiko-$STAMP.dump"

echo "[backup] dumping to $FILE"
pg_dump --format=custom --no-owner --no-privileges --compress=9 --file="$FILE" "$DATABASE_URL"

# A dump that cannot be listed is not a backup.
pg_restore --list "$FILE" > /dev/null
SIZE="$(du -h "$FILE" | cut -f1)"
echo "[backup] ok: $SIZE"

if [ -n "${S3_BUCKET:-}" ]; then
  echo "[backup] uploading to s3://$S3_BUCKET/"
  aws s3 cp "$FILE" "s3://$S3_BUCKET/$(basename "$FILE")"
fi

# Keep the most recent $KEEP local dumps.
ls -1t "$OUT_DIR"/jiko-*.dump 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do
  echo "[backup] pruning $old"
  rm -f "$old"
done
