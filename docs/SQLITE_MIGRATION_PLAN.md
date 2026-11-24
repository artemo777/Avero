# SQLite migration plan (safe staged migration)

## Status
This branch is migration-only. The live `main` branch and current PostgreSQL deployment are unchanged. This plan is not a completed migration and does not authorize switching the bot to a new/empty database.

## Why a direct provider switch is unsafe
The current Prisma schema uses PostgreSQL-specific array columns (`String[]`), PostgreSQL `VarChar` annotations, and a `Json` session payload. The game-session repository also issues a PostgreSQL advisory-lock SQL query. SQLite does not support that query or Prisma's PostgreSQL array column type. A new SQLite file would be a separate database and could contain none of the existing economy/profile records.

## Required conversion work
1. Keep the current PostgreSQL schema/client as a read-only source for export.
2. Create a separate SQLite schema/client, with arrays represented in a documented JSON-string encoding and game payload serialized consistently. Do not change the live client until adapter code and tests pass.
3. Remove PostgreSQL-specific raw SQL from runtime code and design SQLite-safe transaction/concurrency behavior. Verify reward settlement and request/economy paths for race conditions.
4. Add a migration utility that reads from PostgreSQL and writes to a newly-created SQLite staging file. It must refuse to overwrite an existing file by default, require explicit confirmation for replacement, and never mutate the source database.
5. Export every model in the schema, preserving IDs, timestamps, binary profile banner data, and relationships/unique-key semantics. For array and JSON fields, encode and decode consistently.
6. Produce an audit report with per-table source/destination counts and validation of key aggregates (balances, gem balances, purchases, transaction totals, profile records, and active sessions). Stop on mismatch.
7. Run tests against a disposable SQLite file, covering economy transfer/reward transaction behavior, profile customization, autoresponder arrays, reaction settings, memory, game sessions and health readiness.
8. Configure the host's persistent-volume path and backups before any cutover. SQLite must not be stored in a temporary/container filesystem.
9. Cut over only after a verified backup and import, and with a tested rollback path. Keep PostgreSQL and its backup intact until the new deployment is verified.

## Cutover checklist
- [ ] Separate SQLite schema/client generated and tested
- [ ] Adapter/serialization code tested
- [ ] PostgreSQL advisory-lock usage eliminated or replaced with portable logic
- [ ] Export/import tested on a disposable source and destination
- [ ] All table counts and key aggregates match
- [ ] Full test suite passes
- [ ] Persistent storage and backup verified on host
- [ ] Rollback documented and tested
- [ ] Explicit operator approval for cutover

## Non-goals
This staged work must not delete PostgreSQL records, drop tables, modify production credentials, or change the live deployment's database target automatically.
