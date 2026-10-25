// Phase 3 — Prisma 7 configuration. Connection URL lives here (not in
// schema.prisma). The placeholder keeps `prisma generate` / `next build`
// working with no DATABASE_URL; any command needing a live database uses
// the real URL from `.env` (see .env.example).

import "dotenv/config";

// CLI commands that reach a live database (e.g. `prisma migrate deploy`)
// prefer DIRECT_URL — a direct/session connection. Prisma Migrate cannot
// run reliably through a transaction pooler (Supabase port 6543). Runtime
// app traffic is unaffected: lib/prisma.ts keeps using DATABASE_URL.
const databaseUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/neuron_academy";

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
