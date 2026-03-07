-- Create web_chat_history table for web chat sessions
CREATE TABLE IF NOT EXISTS web_chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for fast session lookups
CREATE INDEX IF NOT EXISTS idx_web_chat_history_session
  ON web_chat_history (session_id, created_at DESC);

-- Index for user cleanup
CREATE INDEX IF NOT EXISTS idx_web_chat_history_user
  ON web_chat_history (user_id);

-- RLS: service role only (edge function uses service key)
ALTER TABLE web_chat_history ENABLE ROW LEVEL SECURITY;
