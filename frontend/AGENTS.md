# AGENTS.md

Frontend application for TunnelBroker.

## Stack

- Next.js App Router
- React
- TypeScript
- Supabase auth helpers
- Tailwind CSS

## Key Directories

- `app/` - routes, layouts, and API route handlers
- `components/` - UI components
- `utils/` - API and Supabase helpers
- `public/` - static assets
- `types/` - shared TypeScript types

## Configuration

Local runtime file expected but not committed:

- `.env.local`

Committed example:

- `.env.example`

Expected variables:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY` — server-only; required for the headless `/nic/update` DDNS endpoint to read/update `dyndns_tokens` (bypasses RLS). Value is a `sb_secret_*` key (post-2025-07 Supabase key system). Stored in `/etc/tb-frontend/.env.production` on the host, never in repo. Obtain from Supabase project settings → API Keys → "Secret keys" section.
- `TUNNELBROKER_API_URL`
- `TUNNELBROKER_API_KEY`

## Development Guidance

- Keep the frontend aligned with the backend API contract.
- Prefer server-side route handlers in `app/api/` for backend communication patterns already used by the app.
- Keep Supabase configuration public-only in `NEXT_PUBLIC_*` variables unless the architecture is intentionally changed.
- Do not commit `.env.local`, local build output, or local database files.
- Preserve the existing app structure unless there is a clear need for refactor.

## Validation

Use these commands from `frontend/`:

```bash
npm install
npm run dev
npm run build
```

If configuration changes, verify that `.env.example` and relevant README instructions stay in sync.
