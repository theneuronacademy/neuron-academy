// Phase 3 — Health endpoint: build-safe DB connectivity probe.
// Phase 19 — Extended with comprehensive service checks for load balancer integration.
// Used by ops + admin "Website status" wiring. Never throws.

import { ok } from "@/lib/api-response";
import { getDb, isDbConfigured } from "@/lib/prisma";
import { resolveStorageUrl } from "@/lib/storageProvider";

export const dynamic = "force-dynamic";

async function checkDatabase(): Promise<{ status: string; latencyMs?: number; error?: string }> {
  if (!isDbConfigured()) {
    return { status: "not-configured" };
  }
  try {
    const db = getDb();
    if (!db) return { status: "not-configured" };
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    return { status: "connected", latencyMs: Date.now() - start };
  } catch (error) {
    return { status: "unreachable", error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function checkStorage(): Promise<{ status: string; latencyMs?: number; error?: string }> {
  try {
    const start = Date.now();
    await resolveStorageUrl("health-check");
    return { status: "available", latencyMs: Date.now() - start };
  } catch (error) {
    return { status: "unavailable", error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function checkMsg91(): Promise<{ status: string; configured: boolean }> {
  const configured = !!(process.env.MSG91_AUTH_KEY && process.env.MSG91_SENDER_ID);
  return { status: configured ? "configured" : "not-configured", configured };
}

async function checkBiometricBridge(): Promise<{ status: string; lastHeartbeat?: string; error?: string }> {
  try {
    const db = getDb();
    if (!db) return { status: "db-unavailable" };
    const bridge = await db.biometricBridgeStatus.findFirst({
      orderBy: { lastHeartbeatAt: "desc" },
      select: { status: true, lastHeartbeatAt: true },
    });
    if (!bridge) return { status: "no-bridge-registered" };
    const stale = bridge.lastHeartbeatAt && Date.now() - bridge.lastHeartbeatAt.getTime() > 5 * 60 * 1000;
    return {
      status: stale ? "stale" : bridge.status.toLowerCase(),
      lastHeartbeat: bridge.lastHeartbeatAt?.toISOString(),
    };
  } catch (error) {
    return { status: "error", error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function GET() {
  const [database, storage, msg91, biometricBridge] = await Promise.all([
    checkDatabase(),
    checkStorage(),
    checkMsg91(),
    checkBiometricBridge(),
  ]);

  const allHealthy = database.status === "connected" && storage.status === "available";
  const degraded = database.status === "connected" && storage.status !== "available";

  return ok(
    {
      status: allHealthy ? "healthy" : degraded ? "degraded" : "unhealthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "unknown",
      environment: process.env.NODE_ENV || "development",
      services: {
        database,
        storage,
        msg91,
        biometricBridge,
      },
      mode: database.status === "connected" ? "database" : "demo",
      website: "online",
    },
    allHealthy ? 200 : 503
  );
}
