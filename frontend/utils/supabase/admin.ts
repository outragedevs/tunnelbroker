import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the secret API key (`sb_secret_*`).
 *
 * NEVER import this from a client component or expose its return value
 * to the browser. The secret key bypasses RLS and must only run inside
 * route handlers that perform their own authentication (e.g. /nic/update
 * validates HTTP Basic + bcrypt before any query).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY env var"
    );
  }

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
