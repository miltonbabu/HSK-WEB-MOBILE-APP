-- Optional Supabase schema for cross-device usage tracking
-- Only used if VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set
-- Local SQLite remains the source of truth for quota enforcement

CREATE TABLE IF NOT EXISTS usage_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  mode_id TEXT NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  UNIQUE (user_id, mode_id, started_at)
);

CREATE INDEX IF NOT EXISTS idx_usage_user_mode_day
  ON usage_logs(user_id, mode_id, started_at);

-- Row Level Security: users can only see/edit their own usage
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON usage_logs
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own usage" ON usage_logs
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own usage" ON usage_logs
  FOR UPDATE USING (auth.uid()::text = user_id);
