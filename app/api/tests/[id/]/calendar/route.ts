// Phase 21 — Test Calendar Export (.ics)
// Generates iCalendar file for test scheduling

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/session";
import { requireApiRole } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeICS(text: string): string {
  return text.replace(/[,;\\]/g, "\\$&").replace(/\n/g, "\\n");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = requireApiRole(req, ["STUDENT", "FACULTY", "ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const db = getDb();
  if (!db) return dbNotConfigured("Calendar export");

  try {
    const test = await db.test.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        duration: true,
        startTime: true,
        endTime: true,
        batchId: true,
        createdById: true,
        batch: { select: { name: true } },
      },
    });

    if (!test) return fail("Test not found.", 404);

    // Authorization checks
    if (auth.user.role === "STUDENT") {
      const { resolveStudent } = await import("@/lib/testAccess");
      const profile = await resolveStudent(db, auth.user.id, auth.user.email);
      if (!profile) return fail("Student profile not found.", 403);
      const { canStudentAccessTest } = await import("@/lib/testAccess");
      const access = await canStudentAccessTest(db, profile.id, test.id);
      if (!access.allowed) return fail("Access denied.", 403);
    } else if (auth.user.role === "FACULTY") {
      const { facultyBatchIds } = await import("@/lib/testAccess");
      const batchIds = await facultyBatchIds(db, auth.user.id);
      if (test.batchId && !batchIds.includes(test.batchId) && test.createdById !== auth.user.id) {
        return fail("Not authorized for this test.", 403);
      }
    }

    const start = test.startTime ? new Date(test.startTime) : new Date();
    const end = test.endTime ? new Date(test.endTime) : new Date(start.getTime() + test.duration * 60000);

    const uid = `test-${test.id}@neuronacademy.in`;
    const now = new Date();

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Neuron Academy//Test Schedule//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${formatICSDate(now)}`,
      `DTSTART:${formatICSDate(start)}`,
      `DTEND:${formatICSDate(end)}`,
      `SUMMARY:${escapeICS(test.title)}`,
      `DESCRIPTION:${escapeICS(test.description ?? "")}\\n\\nType: ${test.type}\\nDuration: ${test.duration} minutes${test.batch ? `\\nBatch: ${test.batch.name}` : ""}`,
      `STATUS:CONFIRMED`,
      `SEQUENCE:0`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    const ics = lines.join("\r\n");

    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="test-${test.id}.ics"`,
      },
    });
  } catch (err) {
    return serverError("test:calendar", err);
  }
}