# Agent Instructions

These rules apply to the entire repository. Read `PROJECT_CONTEXT.md` before
changing code, schemas, APIs, documentation, or infrastructure.

## Required reading

Before any substantial work, read:

- `PROJECT_CONTEXT.md`
- `docs/architecture.md`
- `docs/domain/business-rules.md`
- `HANDOFF.md`

For catalog or import work, also read:

- `docs/domain/domain-model.md`
- `docs/data/medicine-catalog-strategy.md`

For architecture changes, read all files in `docs/adr/` relevant to the change.

## Architecture rules

- Keep the application a modular monolith until an ADR documents a real reason
  to split deployment units.
- Organize product code by domain, not only by technical layer.
- Do not import database repositories directly into UI components.
- Domain mutations must pass through application services/use cases.
- Cross-domain writes must be explicit and transactional.
- Keep external systems behind adapters, especially national drug data, storage,
  OCR, barcode lookup, e-invoice, printers, and notifications.
- Do not make checkout or goods receipt depend synchronously on a nonessential
  third-party lookup.

## Authentication, multi-tenant and authorization rules

- Every store-owned row must carry a `storeId` directly or be reachable only
  through a parent constrained by `storeId`.
- Never accept `storeId` from request input as proof of access. Resolve the active
  store from the authenticated membership/session and authorize it server-side.
- Every repository query for operational data must be tenant-scoped.
- Passwords must use the configured Argon2id password hasher; never log or persist
  plaintext passwords.
- Sessions must be opaque random tokens stored only as hashes in the database and
  set through secure server cookies. Do not put JWT/session tokens in web storage.
- Login failures must use the persistent rate-limit policy; do not return whether
  an email exists.
- Global catalog records are read-only to ordinary store users.
- `OWNER` is the administrator of one store membership; `SYSTEM_ADMIN` is a
  separate `User.systemRole` for the platform control plane.
- Never model `SYSTEM_ADMIN` as a store membership or silently grant it tenant
  operational access. Cross-store support access requires an explicit audited
  mechanism.
- Role checks alone are insufficient for sensitive operations; also validate the
  resource's store ownership and operation state.

## Catalog rules

- Global catalog is a data boundary, not a required `GlobalProduct` table.
  `RegisteredProduct` and `ProductPackage` are the concrete shared entities.
- `StoreProduct` is the store's local merchandising record and may reference a
  shared record through nullable `registeredProductId`; a `StoreSKU` may reference
  nullable `productPackageId`.
- Store edits must not mutate the global record. Use local overrides.
- Preserve `basedOnGlobalVersion` and explicit override fields so source updates
  can be reconciled.
- Corrections to shared data go through a reviewed submission workflow.
- Same name does not mean same product. Never deduplicate by name alone.
- Different manufacturers or registration numbers are separate registered
  products. Do not model them as versions.
- Barcode belongs to a package/SKU level, not to the abstract drug concept.
- OCR output and unverified community data must never silently overwrite verified
  data.

## Inventory and finance invariants

- Never update stock by editing an aggregate quantity as the source of truth.
- Every stock change creates an immutable `StockMovement` with reason and actor.
- Completed business documents are not hard-deleted. Reverse them with linked
  compensating movements.
- Goods receipt, sale, return, cancellation, and stock adjustment must execute in
  database transactions.
- Sale allocation uses FEFO by earliest expiry, then deterministic tie-breakers.
- Cost of goods sold comes from the actual allocated batches.
- Prevent negative stock unless a future ADR explicitly introduces controlled
  backorders.
- Store monetary values as integer minor units or an exact database decimal;
  never use binary floating point.
- Preserve historical price and cost snapshots on transaction lines.
- Unit conversion must be exact, positive, and traceable to a base unit.

## Audit rules

Audit at minimum:

- Price and conversion changes.
- Receipt completion or cancellation.
- Sale cancellation, return and refund.
- Inventory adjustment and batch changes.
- Role, permission and account changes.
- Global catalog review, merge and correction.

Each audit record must include actor, store when applicable, action, target,
timestamp, reason for sensitive actions, and a safe before/after representation.
Never place secrets, tokens, patient notes, or unnecessary personal data in logs.

## Database and migration rules

- All schema changes use committed migrations.
- Migrations applied to shared environments are immutable; create a new migration
  to correct them.
- Add database constraints for invariants where practical, not only UI checks.
- Use UTC timestamps in storage and ISO 8601 at system boundaries.
- Soft-delete/archive master data referenced by transactions.
- Seed data must distinguish verified source data from synthetic demo data.

## Legacy uplift and compatibility rules

- Legacy pharmacy exports and old software are migration sources, not trusted
  global catalog data.
- Preserve the raw legacy identifier and source in `sourceReference`/staging
  payloads; do not silently overwrite an existing store SKU or price.
- Normalize legacy rows through an adapter before writing current domain tables.
- Legacy prices, units, stock, batches and expiry remain store-scoped. They can
  propose a global match but cannot make a record `VERIFIED` automatically.
- Prefer additive migrations, dual-read/one-write transitions and idempotent
  import keys so an old workflow keeps working while data is upgraded.

## Testing rules

At minimum, test:

- Unit conversions and rounding.
- FEFO allocation across multiple batches.
- Exact COGS calculation from allocations.
- Concurrent attempts to sell the last stock.
- Receipt, sale, return, cancellation and adjustment transaction rollback.
- Tenant isolation and authorization.
- Global-reference plus local-override resolution.
- Import validation, idempotency and duplicate detection.

Any bug involving stock, money, tenant isolation, authorization, or audit must
receive a regression test.

## Documentation and handoff

- Update docs in the same change as behavior or schema changes.
- Add or supersede an ADR when changing an accepted architectural decision.
- Keep `HANDOFF.md` append-only. Add a dated entry after meaningful architecture,
  contract, schema, setup, or workflow changes.
- Handoff entries state status, decisions, changed files, verification, gaps, and
  rules the next contributor must preserve.

## Git conventions

- Branches: `<type>/<short-description>` using lowercase kebab-case.
- Prefer Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`,
  `chore:`, `infra:`.
- Do not mix unrelated refactors into a feature change.
- Never commit credentials, production exports, patient data, or real pharmacy
  transaction data.
