# Prisma production migrations

The active migration at `prisma/migrations/20261021120000_current_schema_baseline/`
was generated from the current `prisma/schema.prisma`. It creates the 38
application tables and 27 enum types used by the application. It excludes
biometric tables and does not seed demo data.

The earlier migration chain is preserved in
`prisma/migrations_legacy_20261021/` for audit purposes. It is not active: it
included canceled biometric tables and did not cover all models in the current
schema.

## Production deployment

Vercel runs `npm run vercel:build`. On production builds only, that script:

1. Checks that no application tables exist, unless this baseline is already
   recorded as applied.
2. Runs `prisma migrate deploy` against `DATABASE_URL`.
3. Generates Prisma Client and builds the Next.js application.

If it finds existing tables without the current baseline, it stops the build
before running a migration. Verify the Vercel `DATABASE_URL` first in that
case; do not assume the database is empty.

## Rules

- Use `npm run db:deploy` for reviewed production migrations.
- Do not run `prisma db push`, `prisma migrate dev`, or `prisma migrate reset`
  against production.
- Do not run `prisma/seed.ts`, demo cleanup scripts, or test-data scripts
  against production.
- Future schema changes must add a migration after the active baseline.
- `prisma/migrations/20261025120000_showcase_description_testimonial_achievement/`
  adds two nullable columns additively (`ResultShowcase.description`,
  `Testimonial.achievement`). It is applied by the normal `migrate deploy`
  pipeline; legacy rows keep their fallback display.
