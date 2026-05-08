# AGENTS.md

This repository is a monorepo for the TunnelBroker platform.

## Scope

The monorepo contains two applications:

- `backend/` - Go service that manages IPv6 tunnel lifecycle, database access, API endpoints, and host-level integration
- `frontend/` - Next.js application that provides the web UI, Supabase auth integration, and API proxy routes to the backend

## Working Rules

- Treat `backend/` and `frontend/` as separate deployable applications.
- Do not introduce shared tooling at the root unless it benefits both applications clearly.
- Prefer making changes inside the relevant app directory instead of adding root-level abstractions.
- Preserve secrets hygiene: commit only example config files, never real credentials.
- Keep the root focused on repository documentation and cross-project coordination.

## Repository Map

- `README.md` - monorepo overview and startup instructions
- `backend/README.md` - backend-specific documentation
- `frontend/README.md` - frontend-specific documentation
- `backend/AGENTS.md` - backend development guidance
- `frontend/AGENTS.md` - frontend development guidance

## Environment Model

There is no shared root `.env`.

Expected local files:

- `backend/.env`
- `backend/cmd/config/config.yaml`
- `frontend/.env.local`

Expected committed examples:

- `backend/.env.example`
- `backend/cmd/config/config.example.yaml`
- `frontend/.env.example`

## Development Commands

Backend:

```bash
cd backend
go mod download
go test ./...
go run ./cmd/tunnelbroker
```

Frontend:

```bash
cd frontend
npm install
npm run dev
npm run build
```

## Monorepo Expectations For Agents

- Before changing both applications, identify whether the contract change is API, auth, or deployment-related.
- When changing backend request or response formats, verify whether `frontend/app/api/` and `frontend/utils/` need coordinated updates.
- When documenting configuration, update example files and relevant README content together.
- Do not commit generated artifacts, local databases, or local environment files.
