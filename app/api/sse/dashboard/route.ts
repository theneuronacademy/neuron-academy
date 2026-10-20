// Phase 19 — Real-time SSE for Admin Dashboard
// Provides live updates for: test status changes, attendance, notifications

import { NextRequest } from "next/server";
import { getDb, isDbConfigured } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";

export const dynamic = "force-dynamic";

const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export async function GET(request: NextRequest) {
  const viewer = getUserFromRequest(request);
  if (!viewer || viewer.role !== "ADMIN") {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!isDbConfigured()) {
    return new Response("SSE requires database", { status: 503 });
  }

  const db = getDb();
  if (!db) {
    return new Response("Database unavailable", { status: 503 });
  }

  const encoder = new TextEncoder();
  let heartbeatInterval: NodeJS.Timeout;
  let isClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller closed
        }
      };

      // Send initial connection event
      send("connected", { timestamp: new Date().toISOString() });

      // Heartbeat
      heartbeatInterval = setInterval(() => {
        send("heartbeat", { timestamp: new Date().toISOString() });
      }, HEARTBEAT_INTERVAL);

      // Poll for changes every 5 seconds
      const pollInterval = setInterval(async () => {
        if (isClosed) {
          clearInterval(pollInterval);
          return;
        }

        try {
          const now = new Date();

          // Check for test status changes
          const liveTests = await db.test.findMany({
            where: {
              status: { in: ["LIVE", "SCHEDULED"] },
              isActive: true,
              OR: [
                { startTime: { lte: now, gte: new Date(now.getTime() - 60000) } },
                { endTime: { lte: now, gte: new Date(now.getTime() - 60000) } },
              ],
            },
            select: { id: true, title: true, status: true, startTime: true, endTime: true },
            take: 10,
          });

          if (liveTests.length > 0) {
            send("test-status-update", { tests: liveTests });
          }

          // Check for recent attendance
          const recentAttendance = await db.attendance.findMany({
            where: {
              createdAt: { gte: new Date(now.getTime() - 30000) },
            },
            include: {
              student: { select: { name: true, studentId: true } },
              batch: { select: { name: true } },
            },
            take: 20,
            orderBy: { createdAt: "desc" },
          });

          if (recentAttendance.length > 0) {
            send("attendance-update", { records: recentAttendance });
          }

          // Check for new notifications
          const recentNotifications = await db.notification.findMany({
            where: {
              createdAt: { gte: new Date(now.getTime() - 30000) },
              status: { in: ["SENT", "SCHEDULED"] },
            },
            select: { id: true, title: true, message: true, status: true, audience: true, priority: true, createdAt: true },
            take: 10,
            orderBy: { createdAt: "desc" },
          });

          if (recentNotifications.length > 0) {
            send("notification-update", { notifications: recentNotifications });
          }
        } catch (error) {
          console.error("SSE poll error:", error);
        }
      }, 5000);

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        isClosed = true;
        clearInterval(heartbeatInterval);
        clearInterval(pollInterval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}