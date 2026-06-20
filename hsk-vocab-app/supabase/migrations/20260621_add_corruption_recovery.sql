-- Schema integrity verification for safe client sync.
-- Adds a health-check table and a verify_schema_integrity() function that
-- clients can call (via Supabase RPC) before syncing local data to remote.
-- If the function returns false, the client should skip sync to avoid
-- corrupting local data with a mismatched remote schema.

CREATE TABLE IF NOT EXISTS db_health_checks (
  id BIGSERIAL PRIMARY KEY,
  check_name TEXT NOT NULL,
  last_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('ok', 'warning', 'error')),
  details JSONB
);

ALTER TABLE db_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read health checks" ON db_health_checks
  FOR SELECT USING (true);

-- Returns true iff all expected tables exist with expected columns.
-- Add new tables/columns here as the schema evolves.
CREATE OR REPLACE FUNCTION verify_schema_integrity()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  missing TEXT;
BEGIN
  -- Check critical tables exist.
  SELECT string_agg(table_name, ', ') INTO missing
  FROM (VALUES
    ('words'), ('user_progress'), ('study_sessions'),
    ('user_profiles'), ('leaderboard'), ('usage_logs')
  ) AS expected(table_name)
  WHERE table_name NOT IN (
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
  );

  IF missing IS NOT NULL THEN
    INSERT INTO db_health_checks (check_name, status, details)
    VALUES ('verify_schema_integrity', 'error', jsonb_build_object('missing_tables', missing));
    RETURN false;
  END IF;

  -- Check critical columns on user_progress.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_progress'
      AND column_name = 'word_id'
  ) THEN
    INSERT INTO db_health_checks (check_name, status, details)
    VALUES ('verify_schema_integrity', 'error', jsonb_build_object('missing_column', 'user_progress.word_id'));
    RETURN false;
  END IF;

  INSERT INTO db_health_checks (check_name, status, details)
  VALUES ('verify_schema_integrity', 'ok', '{}'::jsonb);
  RETURN true;
END;
$$;
