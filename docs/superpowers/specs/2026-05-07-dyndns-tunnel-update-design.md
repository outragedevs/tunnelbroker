# DynDNS-compatible per-tunnel IP update — design

**Status:** approved (2026-05-07)
**Branch:** `feature/dyndns-tunnel-update`
**Author:** k

## 1. Problem

Users with dynamic public IPv4 (home connections, mobile uplinks) currently cannot keep their SIT/GRE tunnels working without logging into the dashboard and manually editing the client IP. The existing `PATCH /api/v1/tunnels/:tunnel_id/ip` endpoint requires the global admin `X-API-Key` and the frontend proxy requires a Supabase browser session — neither is usable from a router or a headless cron job.

## 2. Goal

Provide a headless, per-tunnel, dyndns2-compatible HTTP endpoint that lets a user keep their tunnel's `client_ipv4` in sync with their dynamic public IP, using credentials they can paste into Fritz!Box, MikroTik, OpenWrt, ASUS, OPNsense, or `ddclient`/`inadyn`.

## 3. Non-goals

- Updating IPv6 endpoints (server side is static; clients negotiate IPv6 per tunnel pool).
- Supporting WireGuard tunnels (peers learn the client endpoint automatically after handshake — exposing DDNS for `wg` would only confuse users).
- Token-based auth for any other API endpoint. The DDNS token grants exactly one capability: update IPv4 of one tunnel.
- A custom dashboard for token management beyond create / rotate / revoke.

## 4. Architecture

```
   Router / ddclient / inadyn
        │ HTTP Basic (tunnel_id : token)
        │ ?hostname=tunnel_id&myip=<ip>
        ▼
   nginx (TLS, X-Forwarded-For)
        │
        ▼
   Next.js  GET /nic/update  (public, no Supabase session)
        │
        │  1. parse Basic auth → (username, token_plaintext)
        │  2. lookup row in supabase.dyndns_tokens by username (== tunnel_id)
        │  3. bcrypt.compare(token_plaintext, row.token_hash)
        │  4. require ?hostname == username (sanity)
        │  5. resolve effective IP: ?myip if valid, else X-Forwarded-For first hop
        │  6. compare with current tunnel.client_ipv4 from backend
        │  7. if changed: PATCH /api/v1/tunnels/:id/ip on backend (admin X-API-Key)
        │  8. update last_update_ip, last_update_at on dyndns_tokens row
        │
        ▼
   text/plain  "good 1.2.3.4"  |  "nochg 1.2.3.4"  |  "badauth" | …
```

The Go backend (`tunnelbroker.service` on `127.0.0.1:8080`) is **not changed**. Token storage, validation, and rate-limiting live entirely in Next.js + Supabase. The backend only sees an admin-authenticated `PATCH …/ip` call exactly as it does today from the frontend proxy.

## 5. Endpoint contract — dyndns2

### Request

```
GET /nic/update?hostname=tun-1a2b-1&myip=1.2.3.4 HTTP/1.1
Host: tb.tahio.eu
Authorization: Basic <base64(tun-1a2b-1:<token>)>
User-Agent: <anything>
```

| Param | Required | Notes |
|---|---|---|
| `hostname` | yes | Must equal Basic auth username. Format: `^tun-[0-9a-f]{4}-[12]$`. |
| `myip` | no | IPv4 dotted-quad. If missing, empty, or `auto`, the server uses `X-Forwarded-For` first hop. |
| `myipv6` | no | **Ignored.** Documented but not acted on. |

Method `POST` is also accepted (some clients post). Same query/body parsing.

### Response (always `text/plain; charset=utf-8`)

| Body | HTTP | Trigger |
|---|---|---|
| `good <ip>` | 200 | IP updated; row's last_update_ip changed |
| `nochg <ip>` | 200 | Effective IP equals current tunnel `client_ipv4` |
| `badauth` | 401 | Missing/invalid Basic header, unknown username, bcrypt mismatch |
| `nohost` | 200 | `hostname` ≠ Basic username, tunnel doesn't exist, tunnel belongs to another user, or tunnel type is `wg` |
| `notfqdn` | 200 | `hostname` doesn't match `^tun-[0-9a-f]{4}-[12]$` |
| `abuse` | 200 | Rate limit hit (per-token or per-source-IP) |
| `911` | 200 | Backend 5xx, DB error, unexpected exception |

Status codes follow the de-facto dyndns2 convention: `401` for `badauth` so HTTP-Basic-aware clients re-prompt; `200` for the rest because the body is the actual error code clients parse.

### Effective IP resolution

1. If query param `myip` is present, non-empty, and not the literal string `auto`:
   - Validate as dotted IPv4 (no CIDR, no port, no IPv6). On invalid format → `911` with log entry `bad_myip`.
2. Otherwise read `X-Forwarded-For`, split on `,`, trim, take the first entry, validate as IPv4. On failure → `911` with log entry `no_source_ip`.
3. Reject the resolved IP if it falls in RFC1918, loopback (`127.0.0.0/8`), link-local (`169.254.0.0/16`), or `0.0.0.0/8` → `911` with log entry `rejected_private_ip`. Legitimate dyndns updates always come from a public IPv4.
4. Only after passing all of the above does the request progress to the tunnel comparison and `good`/`nochg` branch.

## 6. Schema (Supabase)

New table:

```sql
CREATE TABLE dyndns_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tunnel_id       text NOT NULL UNIQUE REFERENCES tunnels(id) ON DELETE CASCADE,
  user_id         text NOT NULL,                  -- 4-hex; redundant w/ tunnels but speeds up UI list queries
  token_hash      text NOT NULL,                  -- bcrypt(plaintext, cost=12)
  token_prefix    text NOT NULL,                  -- first 8 chars of plaintext, displayed in UI
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_update_ip  text,
  last_update_at  timestamptz
);

CREATE INDEX dyndns_tokens_user_id_idx ON dyndns_tokens(user_id);
```

RLS policies:

- `SELECT` / `INSERT` / `UPDATE` / `DELETE` allowed only when the calling Supabase session's `auth.uid()` maps to the `user_id` (4-hex) on the row. The exact join is determined by the existing user/profile table in the schema (the implementation plan inspects this and writes the matching policy).
- The Next.js `/nic/update` headless route uses the **Supabase secret key** (`sb_secret_*`, server-side only, env var `SUPABASE_SECRET_KEY`) to bypass RLS, since DDNS updates have no Supabase session and authenticate via Basic auth + bcrypt instead.

Token plaintext format:
- `ddns_<43 chars base64url>` — 32 random bytes from `crypto.randomBytes(32)` URL-safe base64-encoded.
- `token_prefix` = first 8 plaintext chars after the `ddns_` prefix (i.e., chars 5..13). Shown in UI to help users recognise which token they pasted where.

WireGuard tunnels never get a row. The token-create handler refuses `tunnel.type === 'wg'` with HTTP 400.

## 7. Next.js routes

### Public dyndns endpoint
- **`app/nic/update/route.ts`** — `GET` and `POST` handlers, both call the same logic. No Supabase session, only Basic auth + token. Top-level `/nic/update` (not under `/api/*`) so it matches the canonical dyndns2 path.
- Optional alias **`app/api/dyndns/update/route.ts`** — re-exports the same handler. Some routers default to `/api/...` paths and this saves users from path-config trouble.

### Token management (Supabase-session protected)
Mounted under existing `/api/tunnels/[id]/`:

| Method + path | Purpose | Response |
|---|---|---|
| `POST   /api/tunnels/[id]/dyndns` | Create token. Returns `409 Conflict` if row already exists (caller should use rotate). Calls `bcrypt.hash`, inserts row. | `{ token, token_prefix, created_at }` — plaintext shown **once**. |
| `POST   /api/tunnels/[id]/dyndns/rotate` | Generate new plaintext, replace `token_hash`, keep `id`/`created_at`. | `{ token, token_prefix }` |
| `DELETE /api/tunnels/[id]/dyndns` | Revoke (drop row). | 204 |
| `GET    /api/tunnels/[id]/dyndns` | Read metadata (no plaintext). | `{ token_prefix, created_at, last_update_ip, last_update_at } \| null` |

All four require `requireAuthenticatedHex4Id()` (existing helper) and verify `tunnel.user_id === auth.hex4Id`. Rejects WG tunnels.

## 8. UI (frontend dashboard)

For each SIT/GRE tunnel card, add a "Dynamic DNS" panel (collapsed by default). Two states:

**No token:**
- Headline: "Dynamic DNS update". One sentence: "Pozwala routerowi z dynamicznym IP samodzielnie aktualizować client IP tego tunelu."
- Button: **Wygeneruj token DDNS** → POST → modal.

**Has token:**
- Display: `Token: ddns_XXXXXXXX… (utworzony 2026-05-07)`.
- "Ostatnia aktualizacja: 1.2.3.4 — 2026-05-07 14:23 UTC" or "Brak aktualizacji" if never used.
- Buttons: **Rotuj token** (modal with new plaintext), **Usuń token** (confirm).

Modal after create/rotate:
- Plaintext token shown once with copy button.
- Warning: "Zachowaj ten token — po zamknięciu nie pokażę go ponownie."
- Tab/accordion with copy-paste configs for: Fritz!Box, MikroTik (script), OpenWrt (`ddns-scripts`), `ddclient`. Examples below.

WireGuard tunnels: panel hidden completely (no DDNS for WG).

### Router/client snippets shown in UI

**Fritz!Box (Internet → Permit Access → Dynamic DNS → Custom):**
- Update-URL: `https://tb.tahio.eu/nic/update?hostname=<domain>&myip=<ipaddr>`
- Domain name: `tun-1a2b-1`
- Username: `tun-1a2b-1`
- Password: `<token>`

**ddclient (`/etc/ddclient.conf`):**
```
protocol=dyndns2
use=web, web=https://ipv4.icanhazip.com
server=tb.tahio.eu
ssl=yes
login=tun-1a2b-1
password=<token>
tun-1a2b-1
```

**MikroTik RouterOS** (script run from scheduler every N minutes):
```
:local ip [/ip cloud get public-address]
/tool fetch url="https://tb.tahio.eu/nic/update?hostname=tun-1a2b-1&myip=$ip" \
  user="tun-1a2b-1" password="<token>" mode=https keep-result=no
```

**OpenWrt** (`/etc/config/ddns` service section):
```
config service 'tb_tunnel'
    option enabled '1'
    option service_name 'custom'
    option update_url 'https://[USERNAME]:[PASSWORD]@tb.tahio.eu/nic/update?hostname=[DOMAIN]&myip=[IP]'
    option domain 'tun-1a2b-1'
    option username 'tun-1a2b-1'
    option password '<token>'
    option ip_source 'web'
    option ip_url 'https://ipv4.icanhazip.com'
```

## 9. Rate limiting & abuse

- **Per-token:** at most 1 successful update per 30 seconds. On hit → `abuse`. Implemented as in-memory `Map<tunnel_id, last_seen_ts>` in Next.js (PM2 fork mode = single process; if we ever switch to cluster mode, swap for Redis or Supabase row).
- **Per-source-IP:** at most 30 requests per minute per source IP across all tokens (anti-bruteforce against `badauth`). Same in-memory store.
- **Logging:** every request emits a structured pino log line with `route=dyndns`, `tunnel_id`, `source_ip`, `result_code`, `effective_ip` (where applicable). Plaintext token never logged.

## 10. Edge cases

| Case | Handling |
|---|---|
| `hostname` query missing | `notfqdn` |
| `hostname` ≠ Basic username | `nohost` |
| Tunnel exists but belongs to a different user_id | `nohost` (don't leak existence) |
| Tunnel type is `wg` | `nohost` (DDNS not applicable; UI never offered token) |
| `myip` is private/loopback/link-local | `911` + log "rejected_private_ip" |
| Backend `PATCH …/ip` returns 5xx | `911` |
| Backend returns 200 but DB write of `last_update_*` fails | Still return `good <ip>` (the IP was actually changed); log warning |
| Effective IP equals current tunnel client_ipv4 | `nochg <ip>` (still update `last_update_at` for liveness tracking) |
| Multiple successful updates within 30s | `abuse` |
| Tunnel deleted mid-flow | bcrypt+select happens first; if `PATCH` returns 404 → `nohost` |

## 11. Security considerations

- Token plaintext is shown to the user **once** at create/rotate. After that only `token_hash` exists in DB.
- bcrypt cost 12 (~250ms on modern CPU). Worst case at 30 req/min/IP = 0.5 hash/s — fine.
- Supabase secret key (`sb_secret_*`) is read from `/etc/tb-frontend/.env.production` as `SUPABASE_SECRET_KEY` — same convention as existing secrets. Never sent to browser.
- Source IP detection trusts `X-Forwarded-For` only because nginx is the sole upstream. If the deployment topology changes, this assumption must be revisited.
- Token revocation is immediate (delete row → next request gets `badauth`).
- DDoS surface: the public endpoint runs through the same nginx that already protects the dashboard. Per-IP rate limit + bcrypt cost gate practical bruteforce attempts.
- A leaked token is scoped to one tunnel: attacker can only redirect that tunnel's `client_ipv4`. Worst-case impact = tunnel hijack until rotation. No path to other users' tunnels, no path to admin endpoints.

## 12. Testing strategy

- **Backend Go:** unchanged, existing tests cover `UpdateClientIPHandler`. No new Go tests.
- **Next.js dyndns route — unit tests** with mocked Supabase + mocked backend fetch:
  - Each response code (`good`, `nochg`, `badauth`, `nohost`, `notfqdn`, `abuse`, `911`) reproduced via a dedicated test case.
  - hostname/username mismatch → `nohost`.
  - WG tunnel → `nohost`.
  - Private IP → `911`.
  - `myip=auto` → falls through to `X-Forwarded-For`.
  - Two successful updates within 30s → second is `abuse`.
- **Next.js token management routes — unit tests:**
  - Create token returns plaintext once and persists hash.
  - Rotate replaces hash but keeps `id`/`created_at`.
  - Revoke deletes row.
  - WG tunnel → 400.
  - Cross-user access → 403.
- **Manual end-to-end on staging:**
  - `curl -u tun-XXXX-1:<token> 'https://tb.tahio.eu/nic/update?hostname=tun-XXXX-1&myip=1.2.3.4'` returns `good 1.2.3.4`.
  - Same call again → `nochg 1.2.3.4`.
  - Verify `ip tun show tun-XXXX-1` reflects new remote.
  - Bad token → `badauth` (401).
  - ddclient run with dyndns2 protocol → success in ddclient log.

## 13. Rollout / rollback

- Schema migration (`dyndns_tokens` table + RLS) applied via Supabase migration tooling.
- Code lands as a single PR (backend untouched, only Next.js + migration).
- `tb-deploy frontend` rebuilds and restarts PM2.
- Rollback: `tb-rollback` restores previous Next.js build. Schema migration is forward-only but the table is independent — leaving it in place after rollback causes no harm; existing endpoints don't reference it.

## 14. Out of scope (future work)

- Per-user "show all DDNS tokens" overview page.
- Email/webhook notification on IP change.
- IPv6 client endpoint update (only relevant if/when SIT-over-IPv6 or GRE-over-IPv6 is supported).
- HTTP/2 push or websocket flow for live IP tracking on dashboard.
