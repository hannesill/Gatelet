---
title: Updating
description: Automatic and manual update methods
---

## Automatic updates (Watchtower)

The install script sets up [Watchtower](https://containrrr.dev/watchtower/), which automatically pulls new Docker images and restarts the container. Updates are checked every 5 minutes.

No action is required — Gatelet stays up to date automatically.

## Manual update

If you prefer to update manually:

```bash
cd ~/.gatelet && docker compose pull && docker compose up -d
```

## Data persistence

Your data volume is preserved across updates. The SQLite database, encryption keys, and all stored credentials persist through container recreations.

## Breaking changes

Major version updates may include database schema migrations. These run automatically on startup. If a migration fails, Gatelet will log the error and exit — your existing data is not modified until the migration succeeds.
