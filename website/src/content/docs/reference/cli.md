---
title: CLI
description: Command-line interface for Gatelet
---

Gatelet provides a CLI for running the server and performing health checks.

## Commands

### `gatelet`

Start the Gatelet server. This is the default command.

```bash
gatelet
```

On startup, Gatelet:
1. Loads the admin token and derives the master encryption key via HKDF-SHA256
2. Initializes the SQLite database
3. Starts the MCP server on port 4000
4. Starts the admin server on port 4001
5. Prints the admin token and dashboard URL

### `gatelet doctor`

Run health checks to verify your setup.

```bash
gatelet doctor          # Run all checks
gatelet doctor --fix    # Auto-fix what's fixable
gatelet doctor --json   # Machine-readable output
```

Or via npm scripts during development:

```bash
npm run doctor
npm run doctor:fix
```

## Health checks

The doctor command runs 15+ checks including:

| Check | What it verifies |
|---|---|
| Docker | Docker is installed and the socket is accessible |
| Ports | Ports 4000 and 4001 are available |
| Data directory | `$DATA_DIR` exists with correct permissions |
| Database | SQLite database is readable and has expected tables |
| Encryption | Master key can be derived and verified |
| OAuth | OAuth credentials are configured (built-in or custom) |
| Network | Docker networks are configured correctly |

Each check reports pass, fail, or fixable status. The `--fix` flag attempts to resolve fixable issues automatically (e.g. creating missing directories, setting permissions).

## npx

You can also run Gatelet via npx without installing globally:

```bash
npx gatelet@latest
npx gatelet@latest doctor
npx gatelet@latest doctor --fix
```
