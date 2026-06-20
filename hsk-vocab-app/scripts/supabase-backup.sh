#!/usr/bin/env bash
# Supabase Postgres backup script.
# Exports the Supabase DB to a timestamped .sql file via pg_dump.
#
# Usage:
#   SUPABASE_DB_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" \
#     ./scripts/supabase-backup.sh
#
# Optional env:
#   BACKUP_DIR=./backups        (default)
#   RETENTION_DAYS=30           (delete backups older than this)
#
# Can be run manually or wired into a GitHub Action / cron.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_URL="${SUPABASE_DB_URL:-}"

if [ -z "$DB_URL" ]; then
  echo "ERROR: SUPABASE_DB_URL is not set." >&2
  echo "Get it from Supabase Dashboard → Project Settings → Database → Connection string (URI)." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump is not installed. Install PostgreSQL client tools." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
FILE="$BACKUP_DIR/supabase-backup-$TIMESTAMP.sql.gz"

echo "Backing up Supabase to $FILE ..."
pg_dump --no-owner --no-privileges --clean --if-exists "$DB_URL" | gzip > "$FILE"

echo "Backup complete: $FILE ($(du -h "$FILE" | cut -f1))"

# Prune old backups.
if [ "$RETENTION_DAYS" -gt 0 ]; then
  find "$BACKUP_DIR" -name "supabase-backup-*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
  echo "Pruned backups older than $RETENTION_DAYS days."
fi
