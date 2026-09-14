-- Chinese Writing Practice: session + per-question attempt history.
--
-- Additive and idempotent, mirroring the Phase B learning tables. The app is
-- local-first (SQLite in src/services/database.ts); these tables are the cloud
-- counterpart used when a signed-in user's history is synced. RLS follows the
-- existing owner-only pattern keyed on auth.uid().

-- ── writing_sessions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS writing_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hsk_level INTEGER NOT NULL,
  scope TEXT NOT NULL,
  practice_mode TEXT NOT NULL,
  order_type TEXT NOT NULL,
  question_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  accuracy REAL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_writing_sessions_user ON writing_sessions(user_id, started_at DESC);

-- ── writing_attempts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS writing_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES writing_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id UUID,
  question_type TEXT NOT NULL,
  expected_answer TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  pinyin_input TEXT DEFAULT '',
  is_correct BOOLEAN DEFAULT false,
  accuracy REAL DEFAULT 0,
  time_taken REAL DEFAULT 0,
  mistakes JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_writing_attempts_user ON writing_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_writing_attempts_session ON writing_attempts(session_id);

-- ── RLS ──────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='writing_sessions') THEN RETURN; END IF;
  ALTER TABLE writing_sessions ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='writing_sessions owner read' AND tablename='writing_sessions') THEN
    CREATE POLICY "writing_sessions owner read" ON writing_sessions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='writing_sessions owner insert' AND tablename='writing_sessions') THEN
    CREATE POLICY "writing_sessions owner insert" ON writing_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='writing_sessions owner update' AND tablename='writing_sessions') THEN
    CREATE POLICY "writing_sessions owner update" ON writing_sessions FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='writing_sessions owner delete' AND tablename='writing_sessions') THEN
    CREATE POLICY "writing_sessions owner delete" ON writing_sessions FOR DELETE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='writing_attempts') THEN RETURN; END IF;
  ALTER TABLE writing_attempts ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='writing_attempts owner read' AND tablename='writing_attempts') THEN
    CREATE POLICY "writing_attempts owner read" ON writing_attempts FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='writing_attempts owner insert' AND tablename='writing_attempts') THEN
    CREATE POLICY "writing_attempts owner insert" ON writing_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='writing_attempts owner update' AND tablename='writing_attempts') THEN
    CREATE POLICY "writing_attempts owner update" ON writing_attempts FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='writing_attempts owner delete' AND tablename='writing_attempts') THEN
    CREATE POLICY "writing_attempts owner delete" ON writing_attempts FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;