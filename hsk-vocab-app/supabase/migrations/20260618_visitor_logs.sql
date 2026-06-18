-- Visitor analytics table — tracks unique visitors by hashed IP per day
-- One record per IP hash per day (UNIQUE constraint ensures deduplication)

CREATE TABLE IF NOT EXISTS visitor_logs (
  id BIGSERIAL PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  first_visit_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  is_guest BOOLEAN DEFAULT true,
  UNIQUE(ip_hash, visit_date)
);

CREATE INDEX IF NOT EXISTS idx_visitor_logs_date ON visitor_logs(visit_date DESC);

-- RLS: anyone can INSERT (visitor tracking is anonymous), only admins can SELECT/DELETE
ALTER TABLE visitor_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert visitor logs" ON visitor_logs;
CREATE POLICY "Anyone can insert visitor logs" ON visitor_logs
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read visitor logs" ON visitor_logs;
CREATE POLICY "Admins can read visitor logs" ON visitor_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Admins can delete visitor logs" ON visitor_logs;
CREATE POLICY "Admins can delete visitor logs" ON visitor_logs
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );
