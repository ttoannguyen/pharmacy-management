# PERF-L.1 empty-database migration evidence

Status: passed for the migration-chain gate

Date: 2026-08-17

Environment: disposable local PostgreSQL 16 Alpine container on `127.0.0.1:55432`.
The container was removed after the run; no application or shared database was
used.

Command:

```bash
MIGRATION_TEST_DATABASE_URL='postgresql://<temporary-credentials>@127.0.0.1:55432/pharmacy_migration_test' \
  npm run db:migrate:empty-check
```

Result: passed. Prisma discovered and applied all four migrations in order:

1. `20260817053000_initial_foundation`
2. `20260817065944_application_owned_auth`
3. `20260817070000_restore_tenant_constraints`
4. `20260817070107_restore_tenant_constraints`

The command output contained only the local host/port and migration names; no
credential or application database URL was committed. Browser matrix policy is
still pending separately and does not affect this migration-chain result.
