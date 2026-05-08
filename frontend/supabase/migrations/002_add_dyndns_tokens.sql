-- Migration: per-tunnel DDNS update tokens
-- Run this in Supabase SQL Editor on the project hosting the tunnels schema.
-- Date: 2026-05-07

-- Table holds at most one token per tunnel. Plaintext is never stored;
-- only a bcrypt hash and a short prefix used for UI recognition.
CREATE TABLE IF NOT EXISTS public.dyndns_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tunnel_id       text NOT NULL UNIQUE REFERENCES public.tunnels(id) ON DELETE CASCADE,
  user_id         text NOT NULL,
  token_hash      text NOT NULL,
  token_prefix    text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_update_ip  text,
  last_update_at  timestamptz
);

CREATE INDEX IF NOT EXISTS dyndns_tokens_user_id_idx
  ON public.dyndns_tokens(user_id);

COMMENT ON TABLE public.dyndns_tokens IS
  'Per-tunnel DDNS update credentials. One row per SIT/GRE tunnel that opted in.';

-- RLS: only the owner of the tunnel (mapped via relay.auth_user_id -> generated_hex4)
-- may read or modify their token rows from a Supabase session.
-- The headless /nic/update endpoint bypasses RLS by using the service role key.
ALTER TABLE public.dyndns_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dyndns_tokens_owner_select" ON public.dyndns_tokens;
DROP POLICY IF EXISTS "dyndns_tokens_owner_insert" ON public.dyndns_tokens;
DROP POLICY IF EXISTS "dyndns_tokens_owner_update" ON public.dyndns_tokens;
DROP POLICY IF EXISTS "dyndns_tokens_owner_delete" ON public.dyndns_tokens;

CREATE POLICY "dyndns_tokens_owner_select" ON public.dyndns_tokens
  FOR SELECT
  USING (user_id IN (
    SELECT generated_hex4 FROM public.relay WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "dyndns_tokens_owner_insert" ON public.dyndns_tokens
  FOR INSERT
  WITH CHECK (user_id IN (
    SELECT generated_hex4 FROM public.relay WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "dyndns_tokens_owner_update" ON public.dyndns_tokens
  FOR UPDATE
  USING (user_id IN (
    SELECT generated_hex4 FROM public.relay WHERE auth_user_id = auth.uid()
  ))
  WITH CHECK (user_id IN (
    SELECT generated_hex4 FROM public.relay WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "dyndns_tokens_owner_delete" ON public.dyndns_tokens
  FOR DELETE
  USING (user_id IN (
    SELECT generated_hex4 FROM public.relay WHERE auth_user_id = auth.uid()
  ));
