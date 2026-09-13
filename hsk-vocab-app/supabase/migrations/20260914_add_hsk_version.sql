-- HSK 3.0 upgrade — Phase A1: version tagging for vocabulary.
--
-- Adds a nullable `hsk_version` column to `words` so the app can tell the
-- HSK 2.0 and HSK 3.0 word lists apart, plus a version-aware counting
-- function. Additive and idempotent — safe to re-run, no data is overwritten.
--
-- The current word list (levels 1-4) IS the HSK 3.0 list — HSK 3.0 replaced
-- HSK 2.0 for exams after July 2026 — so every existing row is tagged '3.0'.
-- hsk_level (1-4) is left untouched.

ALTER TABLE words ADD COLUMN IF NOT EXISTS hsk_version VARCHAR(10) DEFAULT NULL;

-- Tag the existing HSK 3.0 vocabulary.
UPDATE words SET hsk_version = '3.0';

CREATE INDEX IF NOT EXISTS idx_words_hsk_version ON words(hsk_version);
CREATE INDEX IF NOT EXISTS idx_words_version_level ON words(hsk_version, hsk_level);

-- Version-aware word totals. Grouped by (version, level) so callers never
-- hard-code per-level counts. Untagged rows surface under hsk_version = NULL,
-- which makes the untagged remainder obvious instead of silently disappearing.
CREATE OR REPLACE FUNCTION count_words_by_level_version()
RETURNS TABLE(hsk_version VARCHAR(10), hsk_level INTEGER, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT w.hsk_version, w.hsk_level, COUNT(*)::BIGINT
  FROM words w
  GROUP BY w.hsk_version, w.hsk_level
  ORDER BY w.hsk_version NULLS FIRST, w.hsk_level;
END;
$$ LANGUAGE plpgsql;
