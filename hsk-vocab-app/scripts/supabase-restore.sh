#!/usr/bin/env bash
# Supabase Postgres restore script.
# Restores a .sql.gz backup file produced by supabase-backup.sh.
#
# Usage:
#   SUPABASE_DB_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" \
#     ./scripts/supabase-restore.sh ./backups/supabase-backup-20260621T120000Z.sql.gz
#
# WARNING: This overwrites the current database state. The backup file uses
# --clean --if-exists, so existing tables are dropped before re-creation.

set -euo pipefail

DB_URL="${SUPABASE_DB_URL:-}"
FILE="${1:-}"

if [ -z "$DB_URL" ]; then
  echo "ERROR: SUPABASE_DB_URL is not set." >&2
  exit 1
fi

if [ -z "$FILE" ]; then
  echo "ERROR: No backup file specified." >&2
  echo "Usage: $0 <path-to-backup.sql.gz>" >&2
  exit 1
fi

if [ ! -f "$FILE" ]; then
  echo "ERROR: File not found: $FILE" >&2
  exit 1
fi

echo "Restoring $FILE to Supabase ..."
echo "WARNING: This will DROP and recreate existing tables. Press Ctrl+C within 5s to abort."
sleep 5

gunzip -c "$FILE" | psql "$DB_URL" 2>&1 | tail -20

echo "Restore complete."
