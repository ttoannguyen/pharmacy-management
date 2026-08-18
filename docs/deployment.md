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

Git branches have separate responsibilities:

- `main` is the default integration branch and creates preview deployments.
- `production` is the Vercel production branch.
- A release is promoted by merging the verified `main` revision into
  `production`; production fixes must be merged back into `main`.

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

`.vercelignore` excludes all local `.env*` files from deployment uploads. Vercel
must inject production values from its encrypted environment settings instead.

## Release order

1. Run tests, typecheck, lint, production build and empty migration-chain check
   on `main`.
2. Promote the verified revision from `main` to `production`.
3. Apply committed migrations once with `prisma migrate deploy` and `DIRECT_URL`.
4. Deploy the immutable `production` revision to Vercel production.
5. Smoke-test `/api/health`, login, active-store selection and catalog APIs.
6. Repeat the concurrency 1/5/20 performance profile in the deployed region.

Dependency installation runs `prisma generate` through `postinstall`; generated
client files remain ignored and must not be committed. Generate does not connect
to PostgreSQL and may use the guarded localhost placeholder from
`prisma.config.ts`; migration/admin commands still fail without `DIRECT_URL`.

The fast quality job runs for pull requests, `main` and `production`. The heavier
Chromium/Firefox evidence job runs only for `production` or a manual workflow
dispatch, rather than on every development push.

After the system-role migration is deployed, bootstrap the first platform admin
once with server-only `SYSTEM_ADMIN_EMAIL`, `SYSTEM_ADMIN_PASSWORD` and optional
`SYSTEM_ADMIN_DISPLAY_NAME`, then run `npm run db:bootstrap-admin`. The command
uses `DIRECT_URL`, stores an Argon2id hash and writes a system audit record.

Breaking schema changes must use an expand/migrate/contract sequence so the old
and new application revisions can overlap safely during rollout.

## Recovery

- Enable provider-managed backups before storing operational production data.
- Test restore into an isolated project on a schedule.
- Keep database migrations append-only after they reach a shared environment.
- Roll back application code by deploying the previous immutable revision; use a
  forward corrective migration instead of editing an applied migration.

## Active release identification

Every deployment exposes a safe release identity at `GET /api/health` and in the
home, dashboard and system-admin UI. The active version format is
`<package-version>+<git-sha-7>`, for example `0.1.0+f153237`.

- Vercel production uses `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF` and
  `VERCEL_ENV`; these values contain deployment metadata, never credentials.
- Enable **Automatically expose System Environment Variables** in the Vercel
  project. Without it, the endpoint intentionally reports `0.1.0+local` rather
  than guessing a revision.
- `/api/health` is `no-store` and returns the same identity in
  `x-app-version`/`x-release-commit`, so monitors can detect a stale alias or an
  unexpected rollback.
- Never derive active version from the browser bundle, branch name alone or the
  latest Git commit; the running deployment's SHA is authoritative.

Verification:

```bash
curl --fail --silent https://<production-domain>/api/health
```

Confirm that `release.commitSha` exactly matches `origin/production`, not merely
that the endpoint returns HTTP 200.
