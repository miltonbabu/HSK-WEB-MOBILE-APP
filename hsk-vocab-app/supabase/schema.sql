-- HSK 3.0 Vocabulary Learning App - Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Words table (HSK vocabulary)
CREATE TABLE IF NOT EXISTS words (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hsk_level INTEGER NOT NULL CHECK (hsk_level BETWEEN 1 AND 6),
  chinese VARCHAR(50) NOT NULL,
  pinyin VARCHAR(100) NOT NULL,
  english VARCHAR(255) DEFAULT '',
  pos TEXT[] DEFAULT '{}',
  pos_raw VARCHAR(100) DEFAULT '',
  example_sentences TEXT[] DEFAULT '{}',
  audio_url VARCHAR(500) DEFAULT '',
  radical VARCHAR(50) DEFAULT '',
  stroke_count INTEGER DEFAULT 0,
  topic_category VARCHAR(100) DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  avatar_url VARCHAR(500) DEFAULT '',
  daily_goal INTEGER DEFAULT 20,
  streak_count INTEGER DEFAULT 0,
  last_study_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_admin BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  source VARCHAR(20) DEFAULT 'web',
  hsk_level INTEGER DEFAULT 1,
  learning_reason VARCHAR(30) DEFAULT NULL,
  onboarding_completed BOOLEAN DEFAULT false
);

-- Migration: add is_admin/is_active for existing databases
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
-- Migration: add source column to distinguish app vs web users
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'web';
-- Migration: add onboarding fields
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS hsk_level INTEGER DEFAULT 1;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS learning_reason VARCHAR(30) DEFAULT NULL;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- User progress table (SRS tracking)
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  mastery_level INTEGER DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),
  last_reviewed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  next_review TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  review_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  easiness_factor DECIMAL(3,2) DEFAULT 2.50,
  interval INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, word_id)
);

-- Study sessions table
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode VARCHAR(50) NOT NULL,
  words_studied INTEGER DEFAULT 0,
  accuracy DECIMAL(5,2) DEFAULT 0,
  duration INTEGER DEFAULT 0,
  date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(100) NOT NULL,
  avatar_url VARCHAR(500) DEFAULT '',
  score INTEGER DEFAULT 0,
  accuracy DECIMAL(5,2) DEFAULT 0,
  mode VARCHAR(50) NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User sentences table (for sentence making practice)
CREATE TABLE IF NOT EXISTS user_sentences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  sentence TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_words_hsk_level ON words(hsk_level);
CREATE INDEX IF NOT EXISTS idx_words_topic ON words(topic_category);
CREATE INDEX IF NOT EXISTS idx_words_chinese ON words(chinese);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_mastery ON user_progress(mastery_level);
CREATE INDEX IF NOT EXISTS idx_progress_next_review ON user_progress(next_review);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON study_sessions(date);
CREATE INDEX IF NOT EXISTS idx_leaderboard_mode ON leaderboard(mode);
CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);

-- Row Level Security (RLS)
ALTER TABLE words ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sentences ENABLE ROW LEVEL SECURITY;

-- Words: Public read access
CREATE POLICY "Public read words" ON words
  FOR SELECT USING (true);

-- User profiles: Public read, user can update own profile
CREATE POLICY "Public read profiles" ON user_profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- User progress: Users can only access/modify their own
CREATE POLICY "Users can view own progress" ON user_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress" ON user_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress" ON user_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- Study sessions: Users can only access/modify their own
CREATE POLICY "Users can view own sessions" ON study_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON study_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Leaderboard: Public read, users can insert their own scores
CREATE POLICY "Public read leaderboard" ON leaderboard
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own scores" ON leaderboard
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User sentences: Users can only access/modify their own
CREATE POLICY "Users can view own sentences" ON user_sentences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sentences" ON user_sentences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sentences" ON user_sentences
  FOR UPDATE USING (auth.uid() = user_id);

-- Admin policies: words CRUD
CREATE POLICY "Admins can insert words" ON words
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update words" ON words
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can delete words" ON words
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admin policies: user_profiles management
CREATE POLICY "Admins can insert profiles" ON user_profiles
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update any profile" ON user_profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can delete any profile" ON user_profiles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admin policies: user_progress management (clear user data)
CREATE POLICY "Admins can delete any progress" ON user_progress
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admin policies: study_sessions management
CREATE POLICY "Admins can delete any session" ON study_sessions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admin policies: study_sessions read
CREATE POLICY "Admins can view all sessions" ON study_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admin policies: user_progress read
CREATE POLICY "Admins can view all progress" ON user_progress
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER words_updated_at
  BEFORE UPDATE ON words
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_progress_updated_at
  BEFORE UPDATE ON user_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, username)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to count words by HSK level
CREATE OR REPLACE FUNCTION count_words_by_level()
RETURNS TABLE(hsk_level INTEGER, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT w.hsk_level, COUNT(*)::BIGINT
  FROM words w
  GROUP BY w.hsk_level
  ORDER BY w.hsk_level;
END;
$$ LANGUAGE plpgsql;