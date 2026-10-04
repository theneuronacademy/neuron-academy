// Phase 3 — Prisma 7 configuration. Connection URL lives here (not in
// schema.prisma). The placeholder keeps `prisma generate` / `next build`
// working with no DATABASE_URL; any command needing a live database uses
// the real URL from `.env` (see .env.example).

import "dotenv/config";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/neuron_academy";

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
