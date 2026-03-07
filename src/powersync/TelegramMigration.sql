-- Telegram Gateway Migration
-- Run in Supabase SQL Editor

-- 1. Add telegram_id column (TEXT for flexibility, UNIQUE to prevent duplicates)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_id TEXT UNIQUE;

-- 2. Index for fast webhook lookup
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON profiles(telegram_id);
