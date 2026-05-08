/**
 * Single-process sliding-window rate limiter. Keys are arbitrary strings
 * (token id, source IP). Suitable for PM2 fork mode (one process per app).
 * Migrate to Redis or Supabase if we ever switch to cluster mode.
 */
type Bucket = { count: number; windowStart: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  windowMs: number,
  max: number,
  now: number = Date.now()
): { allowed: boolean; remaining: number; resetMs: number } {
  const b = buckets.get(key);
  if (!b || now - b.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: max - 1, resetMs: windowMs };
  }
  if (b.count >= max) {
    return { allowed: false, remaining: 0, resetMs: windowMs - (now - b.windowStart) };
  }
  b.count += 1;
  return { allowed: true, remaining: max - b.count, resetMs: windowMs - (now - b.windowStart) };
}

export const DDNS_TOKEN_WINDOW_MS = 30_000;
export const DDNS_TOKEN_MAX = 1;
export const DDNS_IP_WINDOW_MS = 60_000;
export const DDNS_IP_MAX = 30;
