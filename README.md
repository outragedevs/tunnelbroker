# tb Monorepo

Monorepo for the TunnelBroker system maintained under `outragedevs/tb`.

It contains two applications:

- `backend/` - Go backend responsible for IPv6 tunnel provisioning, prefix allocation, API endpoints, and system integration
- `frontend/` - Next.js frontend responsible for the user panel, authentication via Supabase, and calling the backend API

## Repository Layout

```text
.
|-- backend/
|   |-- cmd/
|   |-- internal/
|   |-- scripts/
|   `-- docs/
|-- frontend/
|   |-- app/
|   |-- components/
|   |-- utils/
|   `-- public/
`-- AGENTS.md
```

## Environment Setup

This monorepo does not use a shared root `.env`.

Application-specific environment files:

- `backend/.env` created from `backend/.env.example`
- `backend/cmd/config/config.yaml` created from `backend/cmd/config/config.example.yaml`
- `frontend/.env.local` created from `frontend/.env.example`

Do not commit real secrets. Only commit example files.

## Local Development

### Backend

```bash
cd backend
cp .env.example .env
cp cmd/config/config.example.yaml cmd/config/config.yaml
go mod download
go run ./cmd/tunnelbroker
```

The backend listens on `127.0.0.1:8080` by default unless changed in `cmd/config/config.yaml`.

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

The frontend runs on `http://localhost:3000` by default.

## Operational Notes

- The frontend server expects the backend API URL and API key through `TUNNELBROKER_API_URL` and `TUNNELBROKER_API_KEY`.
- The frontend also requires Supabase public configuration for authentication.
- The backend requires PostgreSQL connection details via environment variables and additional runtime settings via `cmd/config/config.yaml`.
- Backend and frontend were imported with preserved git history from the original repositories.

## Git Hygiene

- Keep secrets in untracked `.env`, `.env.local`, and `config.yaml` files only.
- Use example files when documenting new configuration.
- Prefer keeping backend-only and frontend-only tooling inside their own directories unless a true monorepo-wide tool is introduced.
