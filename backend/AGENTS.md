# AGENTS.md

Backend application for TunnelBroker.

## Stack

- Go
- Gin
- PostgreSQL via `pgx`
- YAML runtime configuration
- Linux networking and systemd integration

## Key Directories

- `cmd/tunnelbroker/` - main backend entrypoint
- `cmd/tunnelrecovery/` - recovery utility
- `cmd/config/` - runtime config templates
- `internal/` - core application code
- `scripts/` - install, migration, and operational scripts
- `docs/` - backend-specific technical documentation

## Configuration

Local runtime files expected but not committed:

- `.env` for database connection settings
- `cmd/config/config.yaml` for API key, listen address, prefixes, and server settings

Committed examples:

- `.env.example`
- `cmd/config/config.example.yaml`

## Development Guidance

- Prefer small, targeted changes inside `internal/` and `cmd/`.
- Keep API behavior backward compatible unless a coordinated frontend change is also made.
- If request or response payloads change, check the frontend API route handlers and client utilities.
- Avoid hardcoding secrets, hostnames, or real infrastructure values.
- Do not commit generated binaries, local SQLite files, dumps with secrets, or machine-specific config.

## Validation

Use these commands from `backend/`:

```bash
go test ./...
go run ./cmd/tunnelbroker
```

For config-related changes, also verify:

```bash
cp .env.example .env
cp cmd/config/config.example.yaml cmd/config/config.yaml
```

Update examples and documentation whenever new required settings are introduced.
