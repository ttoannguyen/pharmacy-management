# Deployment

## Topology

The initial production topology keeps the modular monolith as one deployment:

```text
Browser -> Vercel Next.js (Node runtime, icn1) -> Supabase PostgreSQL
```

The Supabase project must be in `ap-northeast-2` before using the `icn1`
configuration. Keeping application compute and PostgreSQL in the same region is
a release gate because the measured cross-region baseline misses the catalog
latency budget.

## Environments

- Local uses local developer secrets and may use local PostgreSQL.
- Preview/staging uses a separate Supabase project with synthetic data only.
- Production uses a dedicated Supabase project and production domain.
- Preview deployments must never receive production database credentials.

## Secrets and connections

Vercel runtime variables:

- `DATABASE_URL`: Supabase transaction pooler (`:6543`) for application traffic.
- `AUTH_PEPPER`: server-only random secret with at least 32 characters.
- `NEXT_PUBLIC_APP_URL`: canonical HTTPS application origin.

Release/migration secret:

- `DIRECT_URL`: direct or session-mode connection (`:5432`), available only to
  the single migration job.

Never expose database URLs or `AUTH_PEPPER` through `NEXT_PUBLIC_*`, logs, build
artifacts or client code.

## Release order

1. Run tests, typecheck, lint, production build and empty migration-chain check.
2. Apply committed migrations once with `prisma migrate deploy` and `DIRECT_URL`.
3. Deploy the immutable application revision to Vercel production.
4. Smoke-test `/api/health`, login, active-store selection and catalog APIs.
5. Repeat the concurrency 1/5/20 performance profile in the deployed region.

Breaking schema changes must use an expand/migrate/contract sequence so the old
and new application revisions can overlap safely during rollout.

## Recovery

- Enable provider-managed backups before storing operational production data.
- Test restore into an isolated project on a schedule.
- Keep database migrations append-only after they reach a shared environment.
- Roll back application code by deploying the previous immutable revision; use a
  forward corrective migration instead of editing an applied migration.
