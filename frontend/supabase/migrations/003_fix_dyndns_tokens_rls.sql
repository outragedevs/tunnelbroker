-- Migration: tighten dyndns_tokens RLS to verify tunnel_id ownership
-- Date: 2026-05-07
--
-- The original 002 policies for INSERT/UPDATE only verified that the row's
-- user_id matched the caller's relay.generated_hex4. They did NOT verify
-- that tunnel_id belonged to a tunnel owned by the same user. A malicious
-- authenticated user could therefore insert a token row with their own
-- user_id and a victim's tunnel_id, then drive /nic/update (which uses the
-- service role key and bypasses RLS) to overwrite the victim's client IP.
--
-- This migration replaces the INSERT and UPDATE policies with versions
-- that additionally enforce tunnel ownership through the public.tunnels
-- table. SELECT/DELETE policies remain unchanged: they only expose rows
-- the caller already created on their own user_id, which is a self-leak
-- at worst and was never the attack vector.

DROP POLICY IF EXISTS "dyndns_tokens_owner_insert" ON public.dyndns_tokens;
DROP POLICY IF EXISTS "dyndns_tokens_owner_update" ON public.dyndns_tokens;

CREATE POLICY "dyndns_tokens_owner_insert" ON public.dyndns_tokens
  FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT generated_hex4 FROM public.relay WHERE auth_user_id = auth.uid()
    )
    AND tunnel_id IN (
      SELECT id FROM public.tunnels WHERE user_id IN (
        SELECT generated_hex4 FROM public.relay WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "dyndns_tokens_owner_update" ON public.dyndns_tokens
  FOR UPDATE
  USING (user_id IN (
    SELECT generated_hex4 FROM public.relay WHERE auth_user_id = auth.uid()
  ))
  WITH CHECK (
    user_id IN (
      SELECT generated_hex4 FROM public.relay WHERE auth_user_id = auth.uid()
    )
    AND tunnel_id IN (
      SELECT id FROM public.tunnels WHERE user_id IN (
        SELECT generated_hex4 FROM public.relay WHERE auth_user_id = auth.uid()
      )
    )
  );
