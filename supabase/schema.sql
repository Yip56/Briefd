-- Briefd database schema

-- Users profile (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  occupation TEXT,
  location TEXT,
  life_stage TEXT,
  vehicle TEXT,
  digest_time TIME DEFAULT '08:00',
  digest_frequency TEXT DEFAULT 'daily',
  email_digest_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Topics the user has selected (preset or custom keyword)
CREATE TABLE user_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  is_preset BOOLEAN DEFAULT true,
  weight FLOAT DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Article cache — avoids re-fetching the same article
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  source_name TEXT,
  source_url TEXT,
  article_url TEXT NOT NULL,
  topic TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-user scored digest entries
CREATE TABLE digest_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  relevance_score FLOAT DEFAULT 0,
  impact_level TEXT DEFAULT 'medium',
  ai_summary TEXT,
  shown_at TIMESTAMPTZ DEFAULT NOW()
);

-- User feedback on articles (drives weight adjustment)
CREATE TABLE article_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  vote TEXT CHECK (vote IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);

-- Email send log
CREATE TABLE email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT,
  article_count INT
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_feedback ENABLE ROW LEVEL SECURITY;

-- profiles: users can only read/update their own row
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- user_topics: users can only CRUD their own rows
CREATE POLICY "user_topics_select_own" ON user_topics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_topics_insert_own" ON user_topics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_topics_update_own" ON user_topics
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_topics_delete_own" ON user_topics
  FOR DELETE USING (auth.uid() = user_id);

-- digest_entries: users can only read their own rows
CREATE POLICY "digest_entries_select_own" ON digest_entries
  FOR SELECT USING (auth.uid() = user_id);

-- article_feedback: users can only CRUD their own rows
CREATE POLICY "article_feedback_select_own" ON article_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "article_feedback_insert_own" ON article_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "article_feedback_update_own" ON article_feedback
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "article_feedback_delete_own" ON article_feedback
  FOR DELETE USING (auth.uid() = user_id);

-- Digest archives — snapshot of old digest_entries before refresh
CREATE TABLE digest_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  articles JSONB NOT NULL,
  label TEXT
);

-- Per-user algorithm customisation
CREATE TABLE user_algorithm_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  impact_weight INT DEFAULT 50,
  topic_weight INT DEFAULT 30,
  recency_weight INT DEFAULT 40,
  keyword_weight INT DEFAULT 15,
  feedback_weight INT DEFAULT 10,
  feedback_penalty INT DEFAULT 20,
  click_read_bonus INT DEFAULT 8,
  custom_keywords JSONB DEFAULT '[]',
  avoidance_keywords JSONB DEFAULT '[]',
  gemini_profile TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Article click tracking
CREATE TABLE article_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  article_url TEXT NOT NULL,
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, article_url)
);

-- Extend article_feedback with reason fields
ALTER TABLE article_feedback ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE article_feedback ADD COLUMN IF NOT EXISTS free_text TEXT;

-- RLS for new tables
ALTER TABLE digest_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_algorithm_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "digest_archives_select_own" ON digest_archives
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "digest_archives_insert_own" ON digest_archives
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_algorithm_settings_select_own" ON user_algorithm_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_algorithm_settings_insert_own" ON user_algorithm_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_algorithm_settings_update_own" ON user_algorithm_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "article_clicks_select_own" ON article_clicks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "article_clicks_insert_own" ON article_clicks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── Updated-at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
