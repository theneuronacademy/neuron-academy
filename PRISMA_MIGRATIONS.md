# Prisma Production Migrations — Safe Deployment Procedure

Baseline: `prisma/migrations/20261006000000_baseline/` (created 2026-10-06 from
commit `f4ccbb1`). Verified byte-identical to
`prisma migrate diff --from-empty --to-schema prisma/schema.prisma`, and the
live Supabase schema diffed EMPTY against `prisma/schema.prisma`
(`migrate diff --from-config-datasource --to-schema` → "empty migration").
The baseline therefore reproduces the existing production schema on a fresh
database and changes nothing on the live database.

## Standard production deploy (every release that touches the schema)

1. `npm run db:generate` — regenerate Prisma Client (also runs on postinstall).
2. `npm run db:deploy` — `prisma migrate deploy`. Applies only pending
   migrations, in order, inside transactions. This is the ONLY command ever
   used against production. It never resets, never seeds, never drops data.
3. `npm run build` — production Next.js build (typechecks; fails on drift).
4. Start: `npm run start` (requires `DATABASE_URL` + `SESSION_SECRET` ≥ 16 chars).

## One-time baseline adoption (live Supabase, already at schema parity)

The live database was created with `db push`, so it has all tables but NO
`_prisma_migrations` history. `migrate status` therefore reports
`20261006000000_baseline` as "not yet applied" — expected. Do NOT run
`migrate deploy` against live until the baseline row is recorded, or deploy
will try to re-create existing tables and fail.

One-time, controlled, after a backup/snapshot, with the pooled
`DATABASE_URL` (read `.env`, never commit it):

- `npx prisma migrate resolve --applied "20261006000000_baseline"`

This writes exactly ONE bookkeeping row to `_prisma_migrations`. It creates
no tables, alters no columns, touches no application rows. Verify afterwards
with `npx prisma migrate status` (must report "database is up to date" /
no pending migrations) and re-check row counts.

## FORBIDDEN in production (data-loss risk)

- `prisma migrate reset` — drops the entire database. NEVER run it outside a
  local throwaway database. There is no script for it; keep it that way.
- `prisma db push` against production (`npm run db:push`) — unreviewed,
  unrecorded schema changes with no history. Development-only.
- `prisma migrate dev` against production — creates shadow databases and
  applies without the deploy safeguards. Development-only.
- `prisma/seed.ts`, `db:cleanup-demo`, `admin:create` against production —
  they insert/delete demo rows. Production data is NEVER seeded, purged,
  or reset.

## Notes

- `DIRECT_URL` (non-pooled connection) is required for `migrate dev` /
  shadow-database flows; the pooled Supabase URL cannot create databases.
- Migration files are deterministic: regenerating the baseline diff must
  produce a byte-identical `migration.sql`.
- Rollback points: `baseline-2026-10-06`, `f4ccbb1` (+ this change set).
