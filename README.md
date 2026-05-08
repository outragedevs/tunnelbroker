# TunnelBroker

IPv6 tunnel broker with a web dashboard. Provisions and manages SIT, GRE, and
WireGuard tunnels for clients with dynamic or static IPv4, delegating /64
prefixes from upstream /44 (or /48) prefix pools.

This is the codebase that runs a real production tunnel-broker service. It is
released as open source under the [MIT License](LICENSE) so the community can
study, fork, and self-host. The layout assumes a single Linux host that owns
upstream IPv6 prefixes and (typically) announces them via BGP.

## Features

- **Three tunnel modes:** SIT (6in4), GRE, and WireGuard
- **Automatic /64 delegation** from /44 and /48 prefix pools, with optional dual-prefix delegation (primary + secondary)
- **Per-tunnel kernel state** managed via `ip` and `iptables`
- **Per-tunnel security:** SMTP/POP3/IMAP port blocks, SYN-flood and ICMP rate limits, fragment drops, configurable bandwidth caps
- **Boot-time recovery:** companion `tunnelrecovery` rebuilds full kernel state from the database after reboot
- **REST API** authenticated with `X-API-Key`, listening only on loopback
- **Web dashboard** with Supabase auth (email + GitHub OAuth)
- **Dynamic DNS endpoint** at `/nic/update` (dyndns2-compatible HTTP Basic + bcrypt token), works with Fritz!Box, MikroTik, OpenWrt, `ddclient`, `inadyn`

## Architecture

```text
                   ┌───────────────────────────────────────────────┐
   public 443  ──► │ nginx (TLS)                                   │
                   │     │                                         │
                   │     ▼                                         │
                   │ tb-frontend  Next.js 16 / PM2  :3000          │
                   │     │  authenticates user via Supabase        │
                   │     │  proxies to backend with admin key      │
                   │     ▼                                         │
                   │ tunnelbroker  Go (gin)  127.0.0.1:8080        │
                   │     │  X-API-Key required                     │
                   │     ▼                                         │
                   │ ip / iptables / wg / FRR (BGP)                │
                   └────────────────────────────────┬──────────────┘
                                                    │
                                                    ▼
                                            Supabase Postgres
                                    (users, tunnels, dyndns_tokens)
```

- **Backend (`backend/`)** is the only component that touches kernel state. It refuses to start on a non-loopback listen address by design.
- **Frontend (`frontend/`)** handles authentication, dashboard rendering, and the headless DDNS endpoint. It is also the only path through which end users reach the backend.
- **Supabase** is the source of truth for users, tunnels, and DDNS tokens. RLS protects user-owned rows; the DDNS endpoint uses a server-only secret key to bypass RLS *after* validating per-tunnel HTTP Basic credentials.

## Tech stack

- **Backend:** Go 1.23+, Gin, godotenv, `gopkg.in/yaml.v3`, `pgx`
- **Frontend:** Next.js 16, React 19, Tailwind CSS v4, shadcn/ui, `@supabase/ssr`, `bcryptjs`
- **Database:** PostgreSQL via Supabase
- **Process management:** systemd (backend), PM2 (frontend)
- **Reverse proxy:** nginx (or any TLS terminator)
- **Optional:** FRR (`bgpd`) for BGP prefix announcement

## Project structure

```text
.
├── backend/                       # Go REST API
│   ├── cmd/
│   │   ├── tunnelbroker/          # main service
│   │   ├── tunnelrecovery/        # boot-time tunnel rebuilder
│   │   └── config/                # config.example.yaml
│   ├── internal/
│   │   ├── tunnels/               # handlers, repository, kernel commands
│   │   ├── db/                    # Postgres connection + migrations
│   │   ├── config/                # YAML config + WireGuard interface init
│   │   └── middleware/            # X-API-Key auth
│   └── scripts/                   # tunnel_security.sh (firewall bootstrap)
├── frontend/                      # Next.js dashboard + DDNS
│   ├── app/                       # route handlers + pages
│   │   ├── api/                   # authenticated proxy routes
│   │   └── nic/update/            # dyndns2-compatible endpoint
│   ├── components/                # UI (Radix + Tailwind)
│   ├── utils/supabase/            # client + admin-key (server-only) helpers
│   └── supabase/migrations/       # SQL migrations
├── docs/                          # design specs and implementation plans
├── LICENSE                        # MIT
└── README.md
```

## Prerequisites

For local development:

- Go **1.23+**
- Node.js **22+** and npm
- A Supabase project (free tier works)

For a production deployment of the **backend**, the host additionally needs:

- Linux kernel with the `sit`, `gre`, and `wireguard` modules
- Root privileges (the service binds raw kernel state with `ip` and `iptables`)
- An IPv4 endpoint reachable from your tunnel clients
- One or more IPv6 prefixes you can delegate from (typically /44 pools you own and announce via BGP)
- `iproute2`, `iptables`, and (optional) `wireguard-tools`
- (Optional) FRR if you want to peer your prefixes upstream

For the **frontend**:

- A reverse proxy to terminate TLS
- A Supabase project with the migrations from `frontend/supabase/migrations/` applied

## Quick start (local development)

```bash
git clone https://github.com/outragedevs/tunnelbroker.git
cd tunnelbroker
```

### Backend

```bash
cd backend
cp .env.example .env
cp cmd/config/config.example.yaml cmd/config/config.yaml
# edit both: Supabase Postgres credentials, your prefix pools, server IPv4, API key

go mod download
go run ./cmd/tunnelbroker
# listens on 127.0.0.1:8080
```

The backend refuses to start on a non-loopback listen address by design — it is meant to sit behind the frontend's authenticated proxy routes, never exposed directly.

### Frontend

```bash
cd frontend
cp .env.example .env.local
# edit: Supabase URL + keys, TUNNELBROKER_API_URL, TUNNELBROKER_API_KEY

npm install
npm run dev
# listens on http://localhost:3000
```

Apply the Supabase migrations under `frontend/supabase/migrations/` to your project (e.g. via `psql` or the Supabase SQL editor — the Supabase REST API does not expose DDL).

## Configuration reference

### Backend `.env`

| Variable | Description |
|---|---|
| `SUPABASE_DB_HOST` | Postgres host (e.g. `db.<project-ref>.supabase.co`) |
| `SUPABASE_DB_PORT` | `5432` |
| `SUPABASE_DB_USER` | Postgres user |
| `SUPABASE_DB_PASSWORD` | Postgres password |
| `SUPABASE_DB_NAME` | `postgres` |
| `CORS_ALLOWED_ORIGINS` | Optional, comma-separated list. Defaults to `http://localhost:3000`. |
| `CONFIG_PATH` | Optional, alternate path to `config.yaml`. Defaults to `cmd/config/config.yaml`. |

### Backend `cmd/config/config.yaml`

Tunnel-broker-specific runtime config: prefix pools (/44 and /48), the server's public IPv4, the admin API key, the listen address, and per-tunnel security defaults. See `cmd/config/config.example.yaml`.

### Frontend `.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Public URL of the deployment (used for OAuth callbacks and DDNS examples) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key (`sb_publishable_*`) |
| `SUPABASE_SECRET_KEY` | Supabase secret key (`sb_secret_*`). Server-only — used by `/nic/update` to bypass RLS *after* HTTP Basic validation |
| `TUNNELBROKER_API_URL` | Internal backend URL, e.g. `http://127.0.0.1:8080/api/v1` |
| `TUNNELBROKER_API_KEY` | Same value as `api.key` in backend `config.yaml` |

## Backend API

All requests require `X-API-Key`. End users do not call this directly — the frontend authenticates the user via Supabase and proxies to the backend.

```
GET    /api/v1/tunnels                       List tunnels
GET    /api/v1/tunnels/user/:user_id         List tunnels for one user
GET    /api/v1/tunnels/:tunnel_id            Tunnel detail
POST   /api/v1/tunnels                       Create tunnel
PATCH  /api/v1/tunnels/:tunnel_id/ip         Update client IPv4 (used by DDNS)
DELETE /api/v1/tunnels/:tunnel_id            Delete tunnel
```

## Dynamic DNS

The frontend exposes a dyndns2-compatible endpoint at `/nic/update` (alias `/api/dyndns/update`):

```
GET https://<host>/nic/update?hostname=<tunnel-id>&myip=<ipv4>
Authorization: Basic <base64(tunnel-id:plaintext-token)>
```

Per-tunnel tokens are generated from the dashboard, shown once in plaintext, and stored as bcrypt hashes (cost 12) plus an 8-character prefix for UI recognition. Rate limits: 1 update / 30 s per token, 30 requests / min per source IP. WireGuard tunnels return `nohost` — for them the peer is identified by handshake, not by an external `myip`.

## Deployment

This codebase ships without a Dockerfile or Helm chart — it is built to run directly on a Linux host as a systemd unit (backend) plus PM2 (frontend) behind nginx. The reference deployment runs:

- `tunnelbroker.service` (systemd) running the Go binary as root, with `tunnelrecovery` as `ExecStartPost`
- PM2 running `next start` as a non-root user, with the dump persisted across reboots
- nginx terminating TLS (Let's Encrypt) and proxying to `localhost:3000`
- FRR `bgpd` announcing the upstream /44 prefixes
- Config dir `/etc/tunnelbroker/` holding `config.yaml` and `.env` (kept outside the repo)

If you want to adapt this to your environment, the key files to study are:

- `backend/cmd/tunnelbroker/main.go` — service entry point and CORS
- `backend/internal/tunnels/service.go` — kernel command construction
- `backend/internal/db/migrations/` — required tables
- `frontend/supabase/migrations/` — RLS policies and DDNS token table

## Contributing

This is the codebase behind a working production deployment, not a generic library. Issues and pull requests are welcome, but feature priorities are driven by what we need in production. If you fork it, expect to customize at minimum:

- Prefix pools and server IPv4 in `backend/cmd/config/config.yaml`
- AS numbers, peer info, and homepage copy in `frontend/components/home/site-data.ts`
- Site URL and metadata in `frontend/app/metadata.ts`

## License

[MIT](LICENSE)
