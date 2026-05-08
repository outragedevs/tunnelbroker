# DynDNS-compatible tunnel IP update — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a per-tunnel, dyndns2-compatible HTTP endpoint at `/nic/update` so users with dynamic IPs can keep SIT/GRE tunnels in sync from routers (Fritz!Box, MikroTik, OpenWrt) and clients (`ddclient`, `inadyn`) using HTTP Basic credentials.

**Architecture:** Backend Go is **untouched** (it already has `PATCH /api/v1/tunnels/:id/ip` with admin `X-API-Key`). All token storage and DDNS logic live in the Next.js layer + a new `dyndns_tokens` table in Supabase. The headless `/nic/update` route uses a Supabase secret-key client (`sb_secret_*`) to bypass RLS, validates HTTP Basic against bcrypt-hashed tokens, then proxies to the existing backend with the admin key.

**Tech Stack:** Next.js 16 (app router), Supabase (Postgres + RLS), `bcryptjs` (pure-JS hash, no native compile), Tailwind + shadcn/ui (existing dialog/card/tabs components). No new test framework introduced — verification is via TypeScript compile, a smoke `curl` script, and the existing `tb-deploy frontend` → manual e2e checklist.

**Spec:** `docs/superpowers/specs/2026-05-07-dyndns-tunnel-update-design.md`

---

## File Structure

**Create:**
- `frontend/supabase/migrations/002_add_dyndns_tokens.sql` — schema + RLS
- `frontend/utils/supabase/admin.ts` — secret-key client (server-only)
- `frontend/utils/dyndns.ts` — token gen, hash, IP detection, response codes
- `frontend/utils/rate-limit.ts` — in-memory per-key sliding-window limiter
- `frontend/app/api/tunnels/[id]/dyndns/route.ts` — `GET`/`POST`/`DELETE` (Supabase-session)
- `frontend/app/api/tunnels/[id]/dyndns/rotate/route.ts` — `POST` (Supabase-session)
- `frontend/app/nic/update/route.ts` — `GET`/`POST` (headless, Basic auth)
- `frontend/app/api/dyndns/update/route.ts` — alias of `/nic/update`
- `frontend/components/dyndns-panel.tsx` — UI panel embedded in tunnel card
- `frontend/components/dyndns-token-modal.tsx` — one-time plaintext display
- `frontend/scripts/test-dyndns.sh` — smoke test script (runnable on staging/prod)

**Modify:**
- `frontend/package.json` — add `bcryptjs` and `@types/bcryptjs`
- `frontend/types/api.ts` — add `DyndnsTokenInfo`, `CreateDyndnsTokenResponse`
- `frontend/app/dashboard/tunnels/tunnels-list.tsx` — embed `<DyndnsPanel>` per SIT/GRE tunnel

**Untouched:**
- `backend/**` — no changes
- `nginx` config on host — no changes (already proxies `tb.tahio.eu` → `localhost:3000`)

---

## Task 1: Schema migration for `dyndns_tokens`

**Files:**
- Create: `frontend/supabase/migrations/002_add_dyndns_tokens.sql`

- [ ] **Step 1: Write the migration SQL**

Write to `frontend/supabase/migrations/002_add_dyndns_tokens.sql`:

```sql
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
-- The headless /nic/update endpoint bypasses RLS by using the Supabase secret key (sb_secret_*).
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
```

- [ ] **Step 2: Verify migration syntax locally with psql --dry-run isn't possible without DB; instead run a syntax check by piping to `psql --set=ON_ERROR_STOP=on -f - --dry-run` only if you have psql — otherwise visually re-read.**

Run (optional, if `psql` is installed locally with a scratch DB connection):
```bash
psql --set=ON_ERROR_STOP=on --quiet -f frontend/supabase/migrations/002_add_dyndns_tokens.sql --dry-run 2>&1 | head
```
Expected: no syntax errors. If no scratch DB, skip and rely on Supabase SQL Editor at apply time.

- [ ] **Step 3: Apply manually on Supabase**

Open Supabase SQL Editor for project `<your-supabase-project-ref>`, paste the file contents, run. Verify with:
```sql
SELECT * FROM public.dyndns_tokens LIMIT 0;
SELECT polname FROM pg_policy WHERE polrelid = 'public.dyndns_tokens'::regclass;
```
Expected: empty SELECT succeeds; four policies listed (`*_owner_select`, `*_owner_insert`, `*_owner_update`, `*_owner_delete`).

- [ ] **Step 4: Commit**

```bash
git add frontend/supabase/migrations/002_add_dyndns_tokens.sql
git -c user.name='kofany' -c user.email='j@dabrowski.biz' commit -m "feat(db): add dyndns_tokens table with RLS"
```

---

## Task 2: bcryptjs dependency + secret-key Supabase client

**Files:**
- Modify: `frontend/package.json` (deps)
- Create: `frontend/utils/supabase/admin.ts`

- [ ] **Step 1: Add bcryptjs**

```bash
cd frontend && npm install bcryptjs && npm install --save-dev @types/bcryptjs
```

Expected: `package.json` gains `"bcryptjs": "^2.4.3"` (or current 2.x) under `dependencies`, and `@types/bcryptjs` under `devDependencies`. `package-lock.json` updated.

- [ ] **Step 2: Create admin Supabase client**

Write `frontend/utils/supabase/admin.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the secret API key (`sb_secret_*`).
 *
 * NEVER import this from a client component or expose its return value
 * to the browser. It bypasses RLS and must only run inside route handlers
 * that perform their own authentication (e.g. /nic/update validates
 * HTTP Basic + bcrypt before any query).
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
```

- [ ] **Step 3: Document the env var requirement**

Open `frontend/AGENTS.md` (existing doc) and append a line under whichever section describes env vars; if none, append at end:

```markdown

## DDNS env vars

`SUPABASE_SECRET_KEY` — required for the headless `/nic/update`
endpoint. Server-only. Stored in `/etc/tb-frontend/.env.production`,
never in repo. Value is a `sb_secret_*` key. Obtain from Supabase project settings → API Keys → "Secret keys" section.
```

If `frontend/AGENTS.md` does not exist, instead append to `frontend/README.md` under a new `## Environment` heading. Verify after edit:

```bash
grep -n SUPABASE_SECRET_KEY frontend/AGENTS.md frontend/README.md 2>/dev/null
```
Expected: at least one match.

- [ ] **Step 4: TypeScript compile check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: zero errors. (Existing codebase compiles cleanly; the only new file `utils/supabase/admin.ts` should add no errors.)

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/utils/supabase/admin.ts frontend/AGENTS.md frontend/README.md
git -c user.name='kofany' -c user.email='j@dabrowski.biz' commit -m "feat(frontend): add bcryptjs and Supabase secret-key client"
```

---

## Task 3: DDNS helpers — token, hash, IP detection, response codes

**Files:**
- Create: `frontend/utils/dyndns.ts`
- Modify: `frontend/types/api.ts`

- [ ] **Step 1: Add types**

Append to `frontend/types/api.ts`:

```typescript
// DDNS types
export interface DyndnsTokenInfo {
  token_prefix: string;
  created_at: string;
  last_update_ip: string | null;
  last_update_at: string | null;
}

export interface CreateDyndnsTokenResponse {
  token: string;          // plaintext, shown to user once
  token_prefix: string;
  created_at: string;
}

export type DyndnsResponseCode =
  | "good"
  | "nochg"
  | "badauth"
  | "nohost"
  | "notfqdn"
  | "abuse"
  | "911";
```

- [ ] **Step 2: Write `utils/dyndns.ts` skeleton with exported helpers**

Write `frontend/utils/dyndns.ts`:

```typescript
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

export const TUNNEL_ID_RE = /^tun-[0-9a-f]{4}-[12]$/;
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const PRIVATE_V4_BLOCKS: Array<[number, number, number]> = [
  // [a, b_min, b_max] for /8 or /16 ranges; expanded inline below
];

export interface GeneratedToken {
  plaintext: string;     // "ddns_<43 base64url>"
  prefix: string;        // first 8 chars after "ddns_"
}

export function generateToken(): GeneratedToken {
  const buf = randomBytes(32);
  const b64url = buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const plaintext = `ddns_${b64url}`;
  const prefix = b64url.slice(0, 8);
  return { plaintext, prefix };
}

export async function hashToken(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, 12);
}

export async function verifyToken(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export function isValidTunnelId(value: string): boolean {
  return TUNNEL_ID_RE.test(value);
}

export function isValidIpv4(value: string): boolean {
  if (!IPV4_RE.test(value)) return false;
  return value.split(".").every((part) => {
    const n = parseInt(part, 10);
    return n >= 0 && n <= 255;
  });
}

/**
 * Reject loopback, RFC1918, link-local, and 0.0.0.0/8.
 * Returns true if the IP is acceptable as a public client endpoint.
 */
export function isPublicIpv4(value: string): boolean {
  if (!isValidIpv4(value)) return false;
  const [a, b] = value.split(".").map((p) => parseInt(p, 10));
  if (a === 0) return false;                          // 0.0.0.0/8
  if (a === 10) return false;                         // 10.0.0.0/8
  if (a === 127) return false;                        // 127.0.0.0/8
  if (a === 169 && b === 254) return false;           // 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return false;  // 172.16.0.0/12
  if (a === 192 && b === 168) return false;           // 192.168.0.0/16
  return true;
}

export function parseBasicAuth(header: string | null): { username: string; password: string } | null {
  if (!header || !header.startsWith("Basic ")) return null;
  const encoded = header.slice("Basic ".length).trim();
  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf-8");
  } catch {
    return null;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return null;
  return {
    username: decoded.slice(0, idx),
    password: decoded.slice(idx + 1),
  };
}

export function firstForwardedFor(header: string | null): string | null {
  if (!header) return null;
  const first = header.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

export function plainText(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
```

(`PRIVATE_V4_BLOCKS` was a leftover sketch — remove the unused declaration before saving.)

- [ ] **Step 3: Sanity test the helpers with `node --test`**

Write `frontend/utils/dyndns.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TUNNEL_ID_RE,
  generateToken,
  hashToken,
  verifyToken,
  isValidTunnelId,
  isValidIpv4,
  isPublicIpv4,
  parseBasicAuth,
  firstForwardedFor,
} from "./dyndns.ts";

test("generateToken returns ddns_-prefixed token with 8-char prefix", () => {
  const { plaintext, prefix } = generateToken();
  assert.match(plaintext, /^ddns_[A-Za-z0-9_-]{43}$/);
  assert.equal(prefix.length, 8);
  assert.equal(plaintext.slice(5, 13), prefix);
});

test("verifyToken matches hashToken output and rejects others", async () => {
  const { plaintext } = generateToken();
  const hash = await hashToken(plaintext);
  assert.equal(await verifyToken(plaintext, hash), true);
  assert.equal(await verifyToken("ddns_wrong", hash), false);
});

test("isValidTunnelId accepts canonical form, rejects others", () => {
  assert.equal(isValidTunnelId("tun-1a2b-1"), true);
  assert.equal(isValidTunnelId("tun-1a2b-2"), true);
  assert.equal(isValidTunnelId("tun-1A2B-1"), false);   // upper-case rejected
  assert.equal(isValidTunnelId("tun-1a2b-3"), false);
  assert.equal(isValidTunnelId("../etc/passwd"), false);
});

test("isPublicIpv4 rejects RFC1918 / loopback / link-local / 0.0.0.0/8", () => {
  for (const ip of ["10.0.0.1", "172.16.5.5", "172.31.1.1", "192.168.1.1", "127.0.0.1", "169.254.1.1", "0.0.0.0"]) {
    assert.equal(isPublicIpv4(ip), false, `${ip} should be private`);
  }
  for (const ip of ["1.2.3.4", "8.8.8.8", "172.15.255.255", "172.32.0.1"]) {
    assert.equal(isPublicIpv4(ip), true, `${ip} should be public`);
  }
});

test("parseBasicAuth decodes user:pass correctly", () => {
  const enc = Buffer.from("tun-1a2b-1:ddns_abc").toString("base64");
  assert.deepEqual(parseBasicAuth(`Basic ${enc}`), {
    username: "tun-1a2b-1",
    password: "ddns_abc",
  });
  assert.equal(parseBasicAuth(null), null);
  assert.equal(parseBasicAuth("Bearer xxx"), null);
  assert.equal(parseBasicAuth("Basic notbase64!!"), null);
});

test("firstForwardedFor returns first hop", () => {
  assert.equal(firstForwardedFor("1.2.3.4, 10.0.0.1"), "1.2.3.4");
  assert.equal(firstForwardedFor("  1.2.3.4  "), "1.2.3.4");
  assert.equal(firstForwardedFor(null), null);
  assert.equal(firstForwardedFor(""), null);
});
```

- [ ] **Step 4: Run the test**

Note: Node 22's built-in test runner does not parse TypeScript natively. Use `tsx` (already transitively installed via Next, but verify) or convert imports.

If `npx tsx` is available:
```bash
cd frontend && npx tsx --test utils/dyndns.test.mjs
```

If not, add tsx as a one-line dev dep first:
```bash
cd frontend && npm install --save-dev tsx
```
Then re-run the test command above.

Expected: `# tests 6 # pass 6 # fail 0`. If any fail, fix `utils/dyndns.ts` and re-run until green.

- [ ] **Step 5: Commit**

```bash
git add frontend/utils/dyndns.ts frontend/utils/dyndns.test.mjs frontend/types/api.ts frontend/package.json frontend/package-lock.json
git -c user.name='kofany' -c user.email='j@dabrowski.biz' commit -m "feat(frontend): add DDNS helpers and types"
```

---

## Task 4: In-memory rate limiter

**Files:**
- Create: `frontend/utils/rate-limit.ts`

- [ ] **Step 1: Write `rate-limit.ts`**

```typescript
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
```

- [ ] **Step 2: Quick test with `node --test`**

Write `frontend/utils/rate-limit.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit } from "./rate-limit.ts";

test("allows up to max within window, blocks afterwards, resets after window", () => {
  const t0 = 1_000_000;
  assert.equal(rateLimit("k", 1000, 2, t0).allowed, true);
  assert.equal(rateLimit("k", 1000, 2, t0 + 100).allowed, true);
  assert.equal(rateLimit("k", 1000, 2, t0 + 200).allowed, false);
  assert.equal(rateLimit("k", 1000, 2, t0 + 1500).allowed, true);
});
```

Run:
```bash
cd frontend && npx tsx --test utils/rate-limit.test.mjs
```
Expected: 1 pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/utils/rate-limit.ts frontend/utils/rate-limit.test.mjs
git -c user.name='kofany' -c user.email='j@dabrowski.biz' commit -m "feat(frontend): add in-memory rate limiter for DDNS"
```

---

## Task 5: Token management API — create / read / rotate / revoke

**Files:**
- Create: `frontend/app/api/tunnels/[id]/dyndns/route.ts`
- Create: `frontend/app/api/tunnels/[id]/dyndns/rotate/route.ts`

- [ ] **Step 1: Write the combined GET/POST/DELETE handler**

Write `frontend/app/api/tunnels/[id]/dyndns/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireAuthenticatedHex4Id } from "@/utils/tunnel-access";
import { createClient } from "@/utils/supabase/server";
import { generateToken, hashToken, isValidTunnelId } from "@/utils/dyndns";
import { getTunnelbrokerApiKey, getTunnelbrokerApiUrl } from "@/utils/backend-api";
import { TunnelResponse, DyndnsTokenInfo, CreateDyndnsTokenResponse } from "@/types/api";

async function fetchTunnel(tunnelId: string, hex4Id: string): Promise<TunnelResponse | NextResponse> {
  const url = `${getTunnelbrokerApiUrl()}/tunnels/${tunnelId}?user_id=${hex4Id}`;
  const r = await fetch(url, { headers: { "X-API-Key": getTunnelbrokerApiKey() } });
  if (!r.ok) {
    return NextResponse.json({ error: `tunnel lookup failed: ${r.status}` }, { status: r.status });
  }
  const data = (await r.json()) as TunnelResponse;
  if (data.tunnel.user_id !== hex4Id) {
    return NextResponse.json({ error: "You do not have access to this tunnel" }, { status: 403 });
  }
  if (data.tunnel.type === "wg") {
    return NextResponse.json({ error: "DDNS is not available for WireGuard tunnels" }, { status: 400 });
  }
  return data;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedHex4Id();
  if ("errorResponse" in auth) return auth.errorResponse;
  const { id: tunnelId } = await params;
  if (!isValidTunnelId(tunnelId)) {
    return NextResponse.json({ error: "Invalid tunnel id" }, { status: 400 });
  }
  const tunnel = await fetchTunnel(tunnelId, auth.hex4Id);
  if (tunnel instanceof NextResponse) return tunnel;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dyndns_tokens")
    .select("token_prefix, created_at, last_update_ip, last_update_at")
    .eq("tunnel_id", tunnelId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json<DyndnsTokenInfo | null>(data ?? null);
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedHex4Id();
  if ("errorResponse" in auth) return auth.errorResponse;
  const { id: tunnelId } = await params;
  if (!isValidTunnelId(tunnelId)) {
    return NextResponse.json({ error: "Invalid tunnel id" }, { status: 400 });
  }
  const tunnel = await fetchTunnel(tunnelId, auth.hex4Id);
  if (tunnel instanceof NextResponse) return tunnel;

  const supabase = await createClient();
  const existing = await supabase
    .from("dyndns_tokens")
    .select("id")
    .eq("tunnel_id", tunnelId)
    .maybeSingle();
  if (existing.error) {
    return NextResponse.json({ error: existing.error.message }, { status: 500 });
  }
  if (existing.data) {
    return NextResponse.json(
      { error: "Token already exists for this tunnel; use POST /rotate to replace it" },
      { status: 409 }
    );
  }

  const { plaintext, prefix } = generateToken();
  const token_hash = await hashToken(plaintext);
  const insert = await supabase
    .from("dyndns_tokens")
    .insert({
      tunnel_id: tunnelId,
      user_id: auth.hex4Id,
      token_hash,
      token_prefix: prefix,
    })
    .select("created_at")
    .single();
  if (insert.error) {
    return NextResponse.json({ error: insert.error.message }, { status: 500 });
  }
  const body: CreateDyndnsTokenResponse = {
    token: plaintext,
    token_prefix: prefix,
    created_at: insert.data.created_at,
  };
  return NextResponse.json(body);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedHex4Id();
  if ("errorResponse" in auth) return auth.errorResponse;
  const { id: tunnelId } = await params;
  if (!isValidTunnelId(tunnelId)) {
    return NextResponse.json({ error: "Invalid tunnel id" }, { status: 400 });
  }
  // ownership is enforced by RLS through the user's session;
  // we still verify via fetchTunnel to give clean error messages
  const tunnel = await fetchTunnel(tunnelId, auth.hex4Id);
  if (tunnel instanceof NextResponse) return tunnel;

  const supabase = await createClient();
  const { error } = await supabase
    .from("dyndns_tokens")
    .delete()
    .eq("tunnel_id", tunnelId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 2: Write the rotate handler**

Write `frontend/app/api/tunnels/[id]/dyndns/rotate/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireAuthenticatedHex4Id } from "@/utils/tunnel-access";
import { createClient } from "@/utils/supabase/server";
import { generateToken, hashToken, isValidTunnelId } from "@/utils/dyndns";
import { getTunnelbrokerApiKey, getTunnelbrokerApiUrl } from "@/utils/backend-api";
import { TunnelResponse, CreateDyndnsTokenResponse } from "@/types/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedHex4Id();
  if ("errorResponse" in auth) return auth.errorResponse;
  const { id: tunnelId } = await params;
  if (!isValidTunnelId(tunnelId)) {
    return NextResponse.json({ error: "Invalid tunnel id" }, { status: 400 });
  }

  // verify tunnel ownership and not-WG
  const tr = await fetch(
    `${getTunnelbrokerApiUrl()}/tunnels/${tunnelId}?user_id=${auth.hex4Id}`,
    { headers: { "X-API-Key": getTunnelbrokerApiKey() } }
  );
  if (!tr.ok) {
    return NextResponse.json({ error: `tunnel lookup failed: ${tr.status}` }, { status: tr.status });
  }
  const td = (await tr.json()) as TunnelResponse;
  if (td.tunnel.user_id !== auth.hex4Id) {
    return NextResponse.json({ error: "You do not have access to this tunnel" }, { status: 403 });
  }
  if (td.tunnel.type === "wg") {
    return NextResponse.json({ error: "DDNS is not available for WireGuard tunnels" }, { status: 400 });
  }

  const supabase = await createClient();
  const { plaintext, prefix } = generateToken();
  const token_hash = await hashToken(plaintext);
  const upd = await supabase
    .from("dyndns_tokens")
    .update({ token_hash, token_prefix: prefix })
    .eq("tunnel_id", tunnelId)
    .select("created_at")
    .single();
  if (upd.error || !upd.data) {
    return NextResponse.json(
      { error: upd.error?.message ?? "No existing token to rotate; use POST /dyndns to create one" },
      { status: upd.error ? 500 : 404 }
    );
  }
  const body: CreateDyndnsTokenResponse = {
    token: plaintext,
    token_prefix: prefix,
    created_at: upd.data.created_at,
  };
  return NextResponse.json(body);
}
```

- [ ] **Step 3: TypeScript compile check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/api/tunnels/\[id\]/dyndns/route.ts frontend/app/api/tunnels/\[id\]/dyndns/rotate/route.ts
git -c user.name='kofany' -c user.email='j@dabrowski.biz' commit -m "feat(frontend): add token management API for DDNS"
```

---

## Task 6: Headless `/nic/update` route (the main dyndns2 endpoint)

**Files:**
- Create: `frontend/app/nic/update/route.ts`

- [ ] **Step 1: Write the route**

Write `frontend/app/nic/update/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  TUNNEL_ID_RE,
  isValidTunnelId,
  isValidIpv4,
  isPublicIpv4,
  parseBasicAuth,
  firstForwardedFor,
  verifyToken,
  plainText,
} from "@/utils/dyndns";
import {
  rateLimit,
  DDNS_TOKEN_WINDOW_MS,
  DDNS_TOKEN_MAX,
  DDNS_IP_WINDOW_MS,
  DDNS_IP_MAX,
} from "@/utils/rate-limit";
import { getTunnelbrokerApiKey, getTunnelbrokerApiUrl } from "@/utils/backend-api";

async function handleUpdate(req: NextRequest): Promise<Response> {
  const sourceIp = firstForwardedFor(req.headers.get("x-forwarded-for")) ?? "0.0.0.0";

  // Per-IP anti-bruteforce gate (independent of auth result)
  const ipLimit = rateLimit(`ip:${sourceIp}`, DDNS_IP_WINDOW_MS, DDNS_IP_MAX);
  if (!ipLimit.allowed) {
    return plainText("abuse", 200);
  }

  const basic = parseBasicAuth(req.headers.get("authorization"));
  if (!basic) return plainText("badauth", 401);

  const url = new URL(req.url);
  const hostname = url.searchParams.get("hostname") ?? "";
  const myipRaw = url.searchParams.get("myip") ?? "";

  // hostname format check first; on bad shape return notfqdn (per dyndns2)
  if (!isValidTunnelId(hostname)) return plainText("notfqdn", 200);

  // username must equal hostname (sanity)
  if (basic.username !== hostname) return plainText("nohost", 200);

  // Look up token row by tunnel_id (= username = hostname)
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("dyndns_tokens")
    .select("tunnel_id, user_id, token_hash, last_update_ip")
    .eq("tunnel_id", hostname)
    .maybeSingle();
  if (error) {
    console.error("dyndns: supabase error", { tunnel_id: hostname, error: error.message });
    return plainText("911", 200);
  }
  if (!row) return plainText("badauth", 401);

  const verified = await verifyToken(basic.password, row.token_hash);
  if (!verified) return plainText("badauth", 401);

  // Per-token rate limit
  const tokLimit = rateLimit(`tok:${row.tunnel_id}`, DDNS_TOKEN_WINDOW_MS, DDNS_TOKEN_MAX);
  if (!tokLimit.allowed) return plainText("abuse", 200);

  // Resolve effective IP
  let effective: string;
  if (myipRaw && myipRaw.toLowerCase() !== "auto") {
    if (!isValidIpv4(myipRaw)) {
      console.warn("dyndns: bad_myip", { tunnel_id: hostname, myip: myipRaw });
      return plainText("911", 200);
    }
    effective = myipRaw;
  } else {
    if (!isValidIpv4(sourceIp)) {
      console.warn("dyndns: no_source_ip", { tunnel_id: hostname, sourceIp });
      return plainText("911", 200);
    }
    effective = sourceIp;
  }
  if (!isPublicIpv4(effective)) {
    console.warn("dyndns: rejected_private_ip", { tunnel_id: hostname, effective });
    return plainText("911", 200);
  }

  // Verify tunnel exists, type, and current IP via backend
  const detailUrl = `${getTunnelbrokerApiUrl()}/tunnels/${hostname}?user_id=${row.user_id}`;
  const detail = await fetch(detailUrl, {
    headers: { "X-API-Key": getTunnelbrokerApiKey() },
  });
  if (detail.status === 404) return plainText("nohost", 200);
  if (!detail.ok) {
    console.error("dyndns: backend_lookup_failed", { tunnel_id: hostname, status: detail.status });
    return plainText("911", 200);
  }
  const detailJson = (await detail.json()) as {
    tunnel: { type: string; client_ipv4?: string; user_id: string };
  };
  if (detailJson.tunnel.user_id !== row.user_id) return plainText("nohost", 200);
  if (detailJson.tunnel.type === "wg") return plainText("nohost", 200);

  const current = detailJson.tunnel.client_ipv4;
  if (current === effective) {
    // same IP — refresh last_update_at for liveness; do not call backend
    await admin
      .from("dyndns_tokens")
      .update({ last_update_at: new Date().toISOString() })
      .eq("tunnel_id", hostname);
    console.info("dyndns: nochg", { tunnel_id: hostname, sourceIp, effective });
    return plainText(`nochg ${effective}`, 200);
  }

  // Push new IP to backend
  const patch = await fetch(`${getTunnelbrokerApiUrl()}/tunnels/${hostname}/ip`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": getTunnelbrokerApiKey(),
    },
    body: JSON.stringify({ user_id: row.user_id, client_ipv4: effective }),
  });
  if (!patch.ok) {
    console.error("dyndns: backend_patch_failed", {
      tunnel_id: hostname,
      status: patch.status,
    });
    return plainText("911", 200);
  }

  // Update token row metadata; failure here doesn't roll back the IP change
  const { error: updErr } = await admin
    .from("dyndns_tokens")
    .update({
      last_update_ip: effective,
      last_update_at: new Date().toISOString(),
    })
    .eq("tunnel_id", hostname);
  if (updErr) {
    console.warn("dyndns: metadata_update_failed", {
      tunnel_id: hostname,
      error: updErr.message,
    });
  }

  console.info("dyndns: good", { tunnel_id: hostname, sourceIp, effective });
  return plainText(`good ${effective}`, 200);
}

export async function GET(req: NextRequest) {
  return handleUpdate(req);
}

export async function POST(req: NextRequest) {
  return handleUpdate(req);
}
```

- [ ] **Step 2: TypeScript compile check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/nic/update/route.ts
git -c user.name='kofany' -c user.email='j@dabrowski.biz' commit -m "feat(frontend): add headless dyndns2 /nic/update endpoint"
```

---

## Task 7: Alias `/api/dyndns/update`

**Files:**
- Create: `frontend/app/api/dyndns/update/route.ts`

- [ ] **Step 1: Write the alias re-export**

Write `frontend/app/api/dyndns/update/route.ts`:

```typescript
// Alias for /nic/update — some routers and dyndns clients prefer
// API-style paths. Both endpoints share the same handler.
export { GET, POST } from "@/app/nic/update/route";
```

- [ ] **Step 2: TypeScript compile check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/dyndns/update/route.ts
git -c user.name='kofany' -c user.email='j@dabrowski.biz' commit -m "feat(frontend): add /api/dyndns/update alias for /nic/update"
```

---

## Task 8: Token-display modal component

**Files:**
- Create: `frontend/components/dyndns-token-modal.tsx`

- [ ] **Step 1: Write the modal**

Write `frontend/components/dyndns-token-modal.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Check } from "lucide-react";

interface Props {
  tunnelId: string;
  token: string | null;
  onClose: () => void;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-muted text-xs p-3 rounded overflow-x-auto">
      <code>{children}</code>
    </pre>
  );
}

export function DyndnsTokenModal({ tunnelId, token, onClose }: Props) {
  if (!token) return null;
  const updateUrl = "https://tb.tahio.eu/nic/update?hostname=<domain>&myip=<ipaddr>";

  const fritzbox = `Update-URL: ${updateUrl}
Domain name: ${tunnelId}
Username:    ${tunnelId}
Password:    ${token}`;

  const ddclient = `protocol=dyndns2
use=web, web=https://ipv4.icanhazip.com
server=tb.tahio.eu
ssl=yes
login=${tunnelId}
password=${token}
${tunnelId}`;

  const mikrotik = `:local ip [/ip cloud get public-address]
/tool fetch url="https://tb.tahio.eu/nic/update?hostname=${tunnelId}&myip=$ip" \\
  user="${tunnelId}" password="${token}" mode=https keep-result=no`;

  const openwrt = `config service 'tb_${tunnelId}'
    option enabled '1'
    option service_name 'custom'
    option update_url 'https://[USERNAME]:[PASSWORD]@tb.tahio.eu/nic/update?hostname=[DOMAIN]&myip=[IP]'
    option domain '${tunnelId}'
    option username '${tunnelId}'
    option password '${token}'
    option ip_source 'web'
    option ip_url 'https://ipv4.icanhazip.com'`;

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>DDNS token for {tunnelId}</DialogTitle>
          <DialogDescription>
            Skopiuj token teraz — po zamknięciu nie pokażemy go ponownie. Możesz w każdej chwili wygenerować nowy (Rotate).
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <code className="flex-1 bg-muted p-2 rounded text-sm break-all font-mono">{token}</code>
          <CopyButton value={token} />
        </div>

        <Tabs defaultValue="fritzbox" className="mt-4">
          <TabsList>
            <TabsTrigger value="fritzbox">Fritz!Box</TabsTrigger>
            <TabsTrigger value="ddclient">ddclient</TabsTrigger>
            <TabsTrigger value="mikrotik">MikroTik</TabsTrigger>
            <TabsTrigger value="openwrt">OpenWrt</TabsTrigger>
          </TabsList>
          <TabsContent value="fritzbox"><CodeBlock>{fritzbox}</CodeBlock></TabsContent>
          <TabsContent value="ddclient"><CodeBlock>{ddclient}</CodeBlock></TabsContent>
          <TabsContent value="mikrotik"><CodeBlock>{mikrotik}</CodeBlock></TabsContent>
          <TabsContent value="openwrt"><CodeBlock>{openwrt}</CodeBlock></TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={onClose}>Zamknij</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: TypeScript compile check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: zero errors. (`Copy`/`Check` are already in `lucide-react`; verify with `grep -r "from \"lucide-react\"" frontend/components | head` if uncertain.)

- [ ] **Step 3: Commit**

```bash
git add frontend/components/dyndns-token-modal.tsx
git -c user.name='kofany' -c user.email='j@dabrowski.biz' commit -m "feat(frontend): add DDNS token display modal"
```

---

## Task 9: DDNS panel component (per-tunnel)

**Files:**
- Create: `frontend/components/dyndns-panel.tsx`

- [ ] **Step 1: Write the panel**

Write `frontend/components/dyndns-panel.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DyndnsTokenInfo, CreateDyndnsTokenResponse } from "@/types/api";
import { DyndnsTokenModal } from "./dyndns-token-modal";

interface Props {
  tunnelId: string;
}

export function DyndnsPanel({ tunnelId }: Props) {
  const [info, setInfo] = useState<DyndnsTokenInfo | null | "loading">("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [plaintext, setPlaintext] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/tunnels/${tunnelId}/dyndns`);
        if (!r.ok) throw new Error(`load failed: ${r.status}`);
        const d = (await r.json()) as DyndnsTokenInfo | null;
        if (!cancelled) setInfo(d);
      } catch (e) {
        if (!cancelled) {
          setInfo(null);
          setError(e instanceof Error ? e.message : "Failed to load DDNS info");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [tunnelId]);

  async function refresh() {
    const r = await fetch(`/api/tunnels/${tunnelId}/dyndns`);
    if (r.ok) setInfo((await r.json()) as DyndnsTokenInfo | null);
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/tunnels/${tunnelId}/dyndns`, { method: "POST" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `create failed: ${r.status}`);
      }
      const d = (await r.json()) as CreateDyndnsTokenResponse;
      setPlaintext(d.token);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create token");
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/tunnels/${tunnelId}/dyndns/rotate`, { method: "POST" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `rotate failed: ${r.status}`);
      }
      const d = (await r.json()) as CreateDyndnsTokenResponse;
      setPlaintext(d.token);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rotate token");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!confirm("Usunąć token DDNS? Update'y z routera/skryptu przestaną działać.")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/tunnels/${tunnelId}/dyndns`, { method: "DELETE" });
      if (!r.ok && r.status !== 204) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `revoke failed: ${r.status}`);
      }
      setInfo(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke token");
    } finally {
      setBusy(false);
    }
  }

  if (info === "loading") {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Dynamic DNS</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Ładowanie…</p></CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Dynamic DNS</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pozwala routerowi z dynamicznym IP (Fritz!Box, MikroTik, OpenWrt, ddclient) samodzielnie aktualizować client IP tego tunelu.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {info === null ? (
            <Button disabled={busy} onClick={create}>
              {busy ? "…" : "Wygeneruj token DDNS"}
            </Button>
          ) : (
            <div className="space-y-2 text-sm">
              <div>Token: <code className="font-mono">ddns_{info.token_prefix}…</code></div>
              <div>Utworzony: {new Date(info.created_at).toLocaleString()}</div>
              <div>
                Ostatnia aktualizacja:{" "}
                {info.last_update_at
                  ? `${info.last_update_ip ?? "—"} (${new Date(info.last_update_at).toLocaleString()})`
                  : "Brak aktualizacji"}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" disabled={busy} onClick={rotate}>Rotuj token</Button>
                <Button variant="destructive" disabled={busy} onClick={revoke}>Usuń token</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DyndnsTokenModal
        tunnelId={tunnelId}
        token={plaintext}
        onClose={() => setPlaintext(null)}
      />
    </>
  );
}
```

- [ ] **Step 2: TypeScript compile check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/dyndns-panel.tsx
git -c user.name='kofany' -c user.email='j@dabrowski.biz' commit -m "feat(frontend): add DDNS panel for tunnel cards"
```

---

## Task 10: Embed DDNS panel in tunnel list

**Files:**
- Modify: `frontend/app/dashboard/tunnels/tunnels-list.tsx`

- [ ] **Step 1: Read the file to find the right insertion point**

```bash
cd frontend && wc -l app/dashboard/tunnels/tunnels-list.tsx
```
Expected: a single number; the file is one component rendering each tunnel as a `<Card>`. Open with your editor and locate the per-tunnel `<Card>` block where actions are shown (delete / update IP buttons).

- [ ] **Step 2: Add the import at the top of the file**

Find the existing imports block and append:

```tsx
import { DyndnsPanel } from "@/components/dyndns-panel";
```

- [ ] **Step 3: Render `<DyndnsPanel>` inside each tunnel's card, but only for SIT/GRE**

Inside the `tunnels.map((tunnel: any) => ( ... ))` block, after the `<CardContent>` that displays IP info and just before the action buttons (or at the bottom of the card body, before closing `</Card>`), insert:

```tsx
{tunnel.type !== "wg" && (
  <div className="mt-4">
    <DyndnsPanel tunnelId={tunnel.id} />
  </div>
)}
```

The exact location depends on the current JSX structure — pick the deepest sensible nesting that's inside the per-tunnel card and outside the action buttons row.

- [ ] **Step 4: Run dev server and visually verify**

```bash
cd frontend && PORT=3100 npm run dev
```

In a separate shell or browser:
- Visit `http://localhost:3100/dashboard/tunnels` after logging in.
- For a SIT/GRE tunnel: panel appears, "Wygeneruj token DDNS" button works, modal shows plaintext token + tabs, list reflects token after refresh.
- For a WG tunnel (if any): panel does NOT appear.

If the dev server can't reach the backend (likely, since prod backend is on the same host), the panel will show a load error — that's acceptable for the visual check; full functional test happens after deploy.

Stop the dev server (Ctrl+C).

- [ ] **Step 5: TypeScript compile check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/dashboard/tunnels/tunnels-list.tsx
git -c user.name='kofany' -c user.email='j@dabrowski.biz' commit -m "feat(frontend): embed DDNS panel in tunnel list"
```

---

## Task 11: Smoke test script + manual e2e checklist

**Files:**
- Create: `frontend/scripts/test-dyndns.sh`

- [ ] **Step 1: Write the smoke test script**

```bash
mkdir -p frontend/scripts
```

Write `frontend/scripts/test-dyndns.sh`:

```bash
#!/usr/bin/env bash
# Smoke test for DDNS endpoint. Run AFTER tb-deploy on the host (or
# against a staging URL). Requires: BASE_URL, TUNNEL_ID, TOKEN env vars.
#
# Usage:
#   BASE_URL=https://tb.tahio.eu TUNNEL_ID=tun-1a2b-1 TOKEN='ddns_xxx' \
#     bash frontend/scripts/test-dyndns.sh

set -euo pipefail

BASE_URL=${BASE_URL:?BASE_URL required}
TUNNEL_ID=${TUNNEL_ID:?TUNNEL_ID required}
TOKEN=${TOKEN:?TOKEN required}
TEST_IP=${TEST_IP:-203.0.113.42}        # TEST-NET-3, never routable

curlw() {
  curl -sS -o /tmp/dyndns.out -w '%{http_code}\n' "$@" || true
  echo "  -> body: $(cat /tmp/dyndns.out)"
}

echo "[1] good response"
curlw -u "$TUNNEL_ID:$TOKEN" "$BASE_URL/nic/update?hostname=$TUNNEL_ID&myip=$TEST_IP"

echo "[2] nochg response (same IP)"
curlw -u "$TUNNEL_ID:$TOKEN" "$BASE_URL/nic/update?hostname=$TUNNEL_ID&myip=$TEST_IP"

echo "[3] badauth (wrong password)"
curlw -u "$TUNNEL_ID:wrong-token" "$BASE_URL/nic/update?hostname=$TUNNEL_ID&myip=$TEST_IP"

echo "[4] notfqdn (bad hostname)"
curlw -u "$TUNNEL_ID:$TOKEN" "$BASE_URL/nic/update?hostname=not-a-tunnel-id&myip=$TEST_IP"

echo "[5] nohost (mismatched username/hostname)"
curlw -u "$TUNNEL_ID:$TOKEN" "$BASE_URL/nic/update?hostname=tun-ffff-1&myip=$TEST_IP"

echo "[6] 911 (private IP rejected)"
curlw -u "$TUNNEL_ID:$TOKEN" "$BASE_URL/nic/update?hostname=$TUNNEL_ID&myip=10.0.0.1"

echo "[7] alias /api/dyndns/update returns same response"
curlw -u "$TUNNEL_ID:$TOKEN" "$BASE_URL/api/dyndns/update?hostname=$TUNNEL_ID&myip=$TEST_IP"
```

```bash
chmod +x frontend/scripts/test-dyndns.sh
```

- [ ] **Step 2: Commit**

```bash
git add frontend/scripts/test-dyndns.sh
git -c user.name='kofany' -c user.email='j@dabrowski.biz' commit -m "test(frontend): add DDNS smoke test script"
```

- [ ] **Step 3: Open PR**

Push branch and open PR:

```bash
git push -u origin feature/dyndns-tunnel-update
gh pr create --title "DynDNS-compatible per-tunnel IP update" --body "$(cat <<'EOF'
## Summary
- Adds headless `/nic/update` endpoint (dyndns2-compatible) so users can keep SIT/GRE tunnels in sync from routers and clients with HTTP Basic credentials.
- Per-tunnel bcrypt-hashed token stored in new `dyndns_tokens` Supabase table.
- New "Dynamic DNS" panel on each SIT/GRE tunnel card with create / rotate / revoke + setup snippets for Fritz!Box, ddclient, MikroTik, OpenWrt.
- Backend Go untouched.

## Spec & Plan
- Spec: `docs/superpowers/specs/2026-05-07-dyndns-tunnel-update-design.md`
- Plan: `docs/superpowers/plans/2026-05-07-dyndns-tunnel-update.md`

## Deploy steps
1. Apply migration `frontend/supabase/migrations/002_add_dyndns_tokens.sql` in Supabase SQL Editor.
2. Add `SUPABASE_SECRET_KEY=...` to `/etc/tb-frontend/.env.production` on the host.
3. `sudo tb-deploy frontend`.
4. Run `BASE_URL=https://tb.tahio.eu TUNNEL_ID=tun-XXXX-1 TOKEN=ddns_XXX bash frontend/scripts/test-dyndns.sh`.

## Test plan
- [ ] Migration applied; `SELECT * FROM dyndns_tokens LIMIT 0;` succeeds and 4 RLS policies are listed.
- [ ] Create token from dashboard → modal shows plaintext once.
- [ ] `curl -u tun-XXXX-1:<token> 'https://tb.tahio.eu/nic/update?hostname=tun-XXXX-1&myip=1.2.3.4'` returns `good 1.2.3.4`.
- [ ] Same call again returns `nochg 1.2.3.4`.
- [ ] `ip tun show tun-XXXX-1` reflects the new remote on the host.
- [ ] Wrong token returns `badauth` (401).
- [ ] WG tunnel returns `nohost`.
- [ ] Smoke script `test-dyndns.sh` reports the expected codes for [1]..[7].
- [ ] Real router test: configure Fritz!Box / ddclient with the snippet, observe a successful update in router log.
- [ ] Rollback works: `sudo tb-rollback` restores prior frontend without breaking dashboard for users without DDNS rows.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.

---

## Self-Review

**Spec coverage check:**

| Spec section | Implementing task |
|---|---|
| §4 Architecture (Next.js + Supabase + admin client) | T2 (admin client), T6 (route) |
| §5 Endpoint contract (params, response codes) | T6 (route handler) |
| §5 Effective IP resolution | T3 (`isPublicIpv4`), T6 (resolution) |
| §6 Schema (`dyndns_tokens` + RLS) | T1 |
| §7 Token mgmt routes (GET/POST/DELETE/rotate) | T5 |
| §7 Public dyndns endpoint + alias | T6, T7 |
| §8 UI panel + modal + snippets | T8, T9, T10 |
| §9 Rate limiting | T4 (limiter), T6 (per-tok + per-IP) |
| §10 Edge cases (WG, private IP, hostname mismatch) | T6 |
| §11 Security (bcrypt cost 12, Supabase secret key) | T2, T3, T6 |
| §12 Testing strategy (helpers TDD + smoke + manual) | T3 (helper tests), T11 (smoke + checklist) |
| §13 Rollout (migration → deploy → e2e) | T11 (PR body deploy steps) |

**Placeholder scan:** No "TBD", "implement later", or "similar to Task N". All code blocks are complete; the only intentional "fill in" point is in T10 step 3 ("exact location depends on current JSX structure") which is a deliberate UI integration judgment call, not a code-content gap.

**Type/name consistency:** `DyndnsTokenInfo`, `CreateDyndnsTokenResponse`, `DyndnsResponseCode` defined in T3 are the same names used in T5/T6/T9. Function names `generateToken`, `hashToken`, `verifyToken`, `isValidTunnelId`, `isValidIpv4`, `isPublicIpv4`, `parseBasicAuth`, `firstForwardedFor`, `plainText` are consistent across T3/T5/T6. Rate-limit constants `DDNS_TOKEN_WINDOW_MS`, `DDNS_TOKEN_MAX`, `DDNS_IP_WINDOW_MS`, `DDNS_IP_MAX` defined in T4 and used identically in T6.
