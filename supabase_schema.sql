-- ============================================================
--  SOUL REAPER WEB — Supabase Database Schema (`players` table)
--  Copy and paste this script into Supabase -> SQL Editor -> Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.players (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  pin TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  exp INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 200,
  gacha_tickets INTEGER NOT NULL DEFAULT 1,
  swords JSONB NOT NULL DEFAULT '["steel_blade"]'::jsonb,
  equipped_sword TEXT NOT NULL DEFAULT 'steel_blade',
  auras JSONB NOT NULL DEFAULT '["#00aaff", "#ff3344", "#22dd66", "#bb55ff", "#ffbb00"]'::jsonb,
  equipped_aura TEXT NOT NULL DEFAULT '#00aaff',
  used_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS) with open policy for anon key server access
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to players" ON public.players;
CREATE POLICY "Allow full access to players"
  ON public.players
  FOR ALL
  USING (true)
  WITH CHECK (true);
