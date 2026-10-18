// Phase 19 — Readiness endpoint: checks if app can serve traffic.
// Verifies: DB migrations applied, critical tables exist, SESSION_SECRET present.

import { NextResponse } from "next/server";
import { getDb, isDbConfigured } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function checkMigrations(): Promise<{ status: string; error?: string }> {
  if (!isDbConfigured()) return { status: "demo-mode" };
  try {
    const db = getDb();
    if (!db) return { status: "demo-mode" };
    const result = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL
    `;
    const count = Number(result[0]?.count || 0);
    return { status: count > 0 ? "applied" : "pending", appliedCount: count };
  } catch (error) {
    return { status: "error", error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function checkCriticalTables(): Promise<{ status: string; tables?: string[]; error?: string }> {
  if (!isDbConfigured()) return { status: "demo-mode" };
  try {
    const db = getDb();
    if (!db) return { status: "demo-mode" };
    const tables = [
      "User",
      "Student",
      "Faculty",
      "Test",
      "Question",
      "TestAttempt",
      "Result",
      "Notification",
      "NotificationDelivery",
      "Batch",
      "Course",
      "AdminAuditLog",
      "AdminPermission",
      "AdminRolePermission",
      "BiometricBridgeStatus",
      "NotificationSchedulerRun",
    ];
    const missing: string[] = [];
    for (const table of tables) {
      try {
        await db.$queryRaw`SELECT 1 FROM "${table}" LIMIT 1`;
      } catch {
        missing.push(table);
      }
    }
    return missing.length === 0 ? { status: "ok", tables } : { status: "missing-tables", tables: missing };
  } catch (error) {
    return { status: "error", error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function checkSessionSecret(): Promise<{ status: string }> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return { status: "missing" };
  if (secret.length < 16) return { status: "weak" };
  return { status: "ok" };
}

export async function GET() {
  const [migrations, tables, sessionSecret] = await Promise.all([
    checkMigrations(),
    checkCriticalTables(),
    checkSessionSecret(),
  ]);

  const ready = migrations.status === "applied" && tables.status === "ok" && sessionSecret.status === "ok";

  return NextResponse.json(
    {
      ready,
      timestamp: new Date().toISOString(),
      checks: {
        migrations,
        tables,
        sessionSecret,
      },
    },
    ready ? 200 : 503
  );
}