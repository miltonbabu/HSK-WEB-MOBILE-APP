-- Phase B learning tables: mistake notebook, exam autosave, diagnostic results.
--
-- Additive and idempotent. RLS mirrors the existing owner-only pattern
-- (user tables keyed by auth.uid()); admins get read access via is_admin.
-- Local-first SQLite equivalents live in src/services/database.ts; this
-- migration is for cloud sync when you choose to wire it up.

-- ── mistakes ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mistakes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID,
  word_id UUID,
  skill TEXT NOT NULL,
  prompt TEXT DEFAULT '',
  user_answer TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT DEFAULT '',
  mastered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_retried_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_mistakes_user ON mistakes(user_id, created_at DESC);

-- ── exam_attempts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hsk_version VARCHAR(10),
  hsk_level INTEGER NOT NULL,
  config JSONB DEFAULT '{}',
  status TEXT NOT NULL,
  answers JSONB DEFAULT '{}',
  section_times JSONB DEFAULT '{}',
  score REAL,
  section_scores JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMPTZ,
  duration_sec INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user ON exam_attempts(user_id, started_at DESC);

-- ── diagnostic_results ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diagnostic_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hsk_level INTEGER NOT NULL,
  overall REAL DEFAULT 0,
  skill_scores JSONB DEFAULT '[]',
  weak_words JSONB DEFAULT '[]',
  level3_mastery REAL,
  level4_readiness REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_diagnostic_user ON diagnostic_results(user_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────
DO $$
BEGIN
  -- mistakes: owner-only write/read, admin read
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='mistakes') THEN RETURN; END IF;
  ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='mistakes owner read' AND tablename='mistakes') THEN
    CREATE POLICY "mistakes owner read" ON mistakes FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='mistakes owner insert' AND tablename='mistakes') THEN
    CREATE POLICY "mistakes owner insert" ON mistakes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='mistakes owner update' AND tablename='mistakes') THEN
    CREATE POLICY "mistakes owner update" ON mistakes FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='mistakes owner delete' AND tablename='mistakes') THEN
    CREATE POLICY "mistakes owner delete" ON mistakes FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- exam_attempts: owner-only
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='exam_attempts') THEN RETURN; END IF;
  ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='exam_attempts owner read' AND tablename='exam_attempts') THEN
    CREATE POLICY "exam_attempts owner read" ON exam_attempts FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='exam_attempts owner insert' AND tablename='exam_attempts') THEN
    CREATE POLICY "exam_attempts owner insert" ON exam_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='exam_attempts owner update' AND tablename='exam_attempts') THEN
    CREATE POLICY "exam_attempts owner update" ON exam_attempts FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='exam_attempts owner delete' AND tablename='exam_attempts') THEN
    CREATE POLICY "exam_attempts owner delete" ON exam_attempts FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- diagnostic_results: owner-only
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='diagnostic_results') THEN RETURN; END IF;
  ALTER TABLE diagnostic_results ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='diagnostic owner read' AND tablename='diagnostic_results') THEN
    CREATE POLICY "diagnostic owner read" ON diagnostic_results FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='diagnostic owner insert' AND tablename='diagnostic_results') THEN
    CREATE POLICY "diagnostic owner insert" ON diagnostic_results FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='diagnostic owner delete' AND tablename='diagnostic_results') THEN
    CREATE POLICY "diagnostic owner delete" ON diagnostic_results FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;