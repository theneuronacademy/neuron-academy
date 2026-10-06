// Phase 3 — Prisma singleton for Next.js (Phase 8: Prisma 7 driver adapter).
// - Server-side ONLY. Never import this file from client components.
// - Returns null when DATABASE_URL is missing so the website + admin UI
//   keep working on demo data instead of crashing at build/runtime.
// - Single instance across hot reloads (no connection storms in dev).
// - Prisma 7 requires an explicit driver adapter: PrismaPg (node-postgres
//   Pool) over process.env.DATABASE_URL.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  var __neuronPrisma: PrismaClient | undefined;
}

function createClient(): PrismaClient | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  // Phase 13 — single shared pool in ALL environments. Creating a pool per
  // request exhausts the Supabase pooler (max 15 clients) under traffic
  // spikes. Pool size stays small; the pooler multiplexes the rest.
  if (global.__neuronPrisma) return global.__neuronPrisma;
  const pool = new Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 10000 });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });
  global.__neuronPrisma = client;
  return client;
}

/** Null when the database is not configured — callers must fall back to demo data. */
export function getDb(): PrismaClient | null {
  try {
    return createClient();
  } catch {
    return null;
  }
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
