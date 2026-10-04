// Phase 3 — Prisma singleton for Next.js.
// - Server-side ONLY. Never import this file from client components.
// - Returns null when DATABASE_URL is missing so the website + admin UI
//   keep working on demo data instead of crashing at build/runtime.
// - Single instance across hot reloads (no connection storms in dev).

import { PrismaClient } from "@prisma/client";

declare global {
  var __neuronPrisma: PrismaClient | undefined;
}

function createClient(): PrismaClient | null {
  if (!process.env.DATABASE_URL) return null;
  if (global.__neuronPrisma) return global.__neuronPrisma;
  const client = new PrismaClient();
  if (process.env.NODE_ENV !== "production") global.__neuronPrisma = client;
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
