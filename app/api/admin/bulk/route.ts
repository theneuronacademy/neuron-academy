// Phase 19 — Bulk Operations API for Admin
// Supports: bulk create, update, delete for Students, Tests, Questions, Notifications, Books, Batches

import { NextRequest } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BulkOperationSchema = z.object({
  operation: z.enum(["create", "update", "delete", "statusChange"]),
  entity: z.enum(["students", "tests", "questions", "notifications", "books", "batches", "faculty"]),
  items: z.array(z.unknown()).min(1).max(500),
  options: z.object({
    skipValidation: z.boolean().optional(),
    continueOnError: z.boolean().optional(),
    notifyAffected: z.boolean().optional(),
  }).optional(),
});

type BulkOperation = z.infer<typeof BulkOperationSchema>;

async function validateStudentCreate(db: any, item: Record<string, unknown>, index: number): Promise<string | null> {
  if (!item.name || typeof item.name !== "string") return `Item ${index}: name is required`;
  if (!item.phone || typeof item.phone !== "string") return `Item ${index}: phone is required`;
  if (item.email && typeof item.email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) {
    return `Item ${index}: invalid email format`;
  }
  if (item.batchId) {
    const batch = await db.batch.findUnique({ where: { id: String(item.batchId) } });
    if (!batch) return `Item ${index}: batch not found`;
  }
  if (item.courseId) {
    const course = await db.course.findUnique({ where: { id: String(item.courseId) } });
    if (!course) return `Item ${index}: course not found`;
  }
  return null;
}

async function validateTestCreate(db: any, item: Record<string, unknown>, index: number): Promise<string | null> {
  if (!item.title || typeof item.title !== "string") return `Item ${index}: title is required`;
  if (item.batchId) {
    const batch = await db.batch.findUnique({ where: { id: String(item.batchId) } });
    if (!batch) return `Item ${index}: batch not found`;
  }
  if (item.duration && (typeof item.duration !== "number" || item.duration < 1)) {
    return `Item ${index}: duration must be a positive number`;
  }
  return null;
}

async function executeBulkCreate(db: any, entity: string, items: Record<string, unknown>[], request: NextRequest, correlationId: string) {
  const results: Array<{ success: boolean; id?: string; error?: string; index: number }> = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      let created: any = null;
      let entityId: string | null = null;

      switch (entity) {
        case "students": {
          const validationError = await validateStudentCreate(db, item, i);
          if (validationError) throw new Error(validationError);
          created = await db.student.create({
            data: {
              studentId: item.studentId ? String(item.studentId) : `NA-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}${i}`,
              name: String(item.name),
              email: item.email ? String(item.email) : `${Date.now()}${i}@student.local`,
              phone: String(item.phone),
              batchId: item.batchId ? String(item.batchId) : undefined,
              courseId: item.courseId ? String(item.courseId) : undefined,
              studentType: item.studentType === "SCHOLARSHIP" ? "SCHOLARSHIP" : "REGULAR",
              joiningDate: item.joiningDate ? new Date(String(item.joiningDate)) : new Date(),
            },
          });
          entityId = created.id;
          break;
        }
        case "tests": {
          const validationError = await validateTestCreate(db, item, i);
          if (validationError) throw new Error(validationError);
          created = await db.test.create({
            data: {
              title: String(item.title),
              description: item.description ? String(item.description) : null,
              batchId: item.batchId ? String(item.batchId) : undefined,
              type: ["LIVE", "OFFLINE", "PRACTICE"].includes(String(item.type).toUpperCase()) ? String(item.type).toUpperCase() : "PRACTICE",
              duration: typeof item.duration === "number" ? item.duration : 60,
              totalMarks: typeof item.totalMarks === "number" ? item.totalMarks : 0,
              startTime: item.startTime ? new Date(String(item.startTime)) : null,
              endTime: item.endTime ? new Date(String(item.endTime)) : null,
              status: ["DRAFT", "SCHEDULED", "PUBLISHED", "LIVE", "COMPLETED"].includes(String(item.status).toUpperCase()) ? String(item.status).toUpperCase() : "DRAFT",
              accessType: ["FREE", "PAID", "PRIVATE"].includes(String(item.accessType).toUpperCase()) ? String(item.accessType).toUpperCase() : "FREE",
              price: typeof item.price === "number" ? item.price : 0,
            },
          });
          entityId = created.id;
          break;
        }
        case "questions": {
          if (!item.testId || !item.questionText) throw new Error(`Item ${i}: testId and questionText required`);
          const test = await db.test.findUnique({ where: { id: String(item.testId) } });
          if (!test) throw new Error(`Item ${i}: test not found`);
          created = await db.question.create({
            data: {
              testId: String(item.testId),
              questionText: String(item.questionText),
              questionType: ["MCQ", "TRUE_FALSE", "SHORT_ANSWER", "NUMERIC"].includes(String(item.questionType).toUpperCase()) ? String(item.questionType).toUpperCase() : "MCQ",
              optionA: item.optionA ? String(item.optionA) : null,
              optionB: item.optionB ? String(item.optionB) : null,
              optionC: item.optionC ? String(item.optionC) : null,
              optionD: item.optionD ? String(item.optionD) : null,
              optionE: item.optionE ? String(item.optionE) : null,
              correctAnswer: item.correctAnswer ? String(item.correctAnswer) : null,
              marks: typeof item.marks === "number" ? item.marks : 1,
              negativeMarks: typeof item.negativeMarks === "number" ? item.negativeMarks : 0,
              explanation: item.explanation ? String(item.explanation) : null,
              order: typeof item.order === "number" ? item.order : 0,
              subject: item.subject ? String(item.subject) : null,
            },
          });
          await db.test.update({ where: { id: String(item.testId) }, data: { totalQuestions: { increment: 1 } } });
          entityId = created.id;
          break;
        }
        case "books": {
          if (!item.title) throw new Error(`Item ${i}: title required`);
          created = await db.book.create({
            data: {
              title: String(item.title),
              description: item.description ? String(item.description) : null,
              author: item.author ? String(item.author) : null,
              subject: item.subject ? String(item.subject) : null,
              className: item.className ? String(item.className) : null,
              category: item.category ? String(item.category) : null,
              coverImageUrl: item.coverImageUrl ? String(item.coverImageUrl) : null,
              pdfUrl: item.pdfUrl ? String(item.pdfUrl) : null,
              externalUrl: item.externalUrl ? String(item.externalUrl) : null,
              visibleTo: ["ALL", "REGULAR_ONLY"].includes(String(item.visibleTo).toUpperCase()) ? String(item.visibleTo).toUpperCase() : "ALL",
              isActive: item.isActive !== false,
              order: typeof item.order === "number" ? item.order : 0,
            },
          });
          entityId = created.id;
          break;
        }
        case "batches": {
          if (!item.name || !item.courseId) throw new Error(`Item ${i}: name and courseId required`);
          const course = await db.course.findUnique({ where: { id: String(item.courseId) } });
          if (!course) throw new Error(`Item ${i}: course not found`);
          if (item.facultyId) {
            const faculty = await db.faculty.findUnique({ where: { id: String(item.facultyId) } });
            if (!faculty) throw new Error(`Item ${i}: faculty not found`);
          }
          created = await db.batch.create({
            data: {
              name: String(item.name),
              courseId: String(item.courseId),
              facultyId: item.facultyId ? String(item.facultyId) : undefined,
              startDate: item.startDate ? new Date(String(item.startDate)) : null,
              endDate: item.endDate ? new Date(String(item.endDate)) : null,
              status: ["ACTIVE", "UPCOMING", "COMPLETED"].includes(String(item.status).toUpperCase()) ? String(item.status).toUpperCase() : "ACTIVE",
            },
          });
          entityId = created.id;
          break;
        }
        case "faculty": {
          if (!item.name || !item.email || !item.phone) throw new Error(`Item ${i}: name, email, phone required`);
          created = await db.faculty.create({
            data: {
              facultyId: item.facultyId ? String(item.facultyId) : `FAC-${Date.now().toString().slice(-6)}${i}`,
              name: String(item.name),
              email: String(item.email),
              phone: String(item.phone),
              qualification: item.qualification ? String(item.qualification) : null,
              experience: item.experience ? String(item.experience) : null,
              bio: item.bio ? String(item.bio) : null,
              subject: item.subject ? String(item.subject) : null,
              designation: item.designation ? String(item.designation) : "Faculty",
              status: ["ACTIVE", "INACTIVE"].includes(String(item.status).toUpperCase()) ? String(item.status).toUpperCase() : "ACTIVE",
            },
          });
          entityId = created.id;
          break;
        }
        default:
          throw new Error(`Unsupported entity for create: ${entity}`);
      }

      results.push({ success: true, id: entityId || undefined, index: i });
      successCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      results.push({ success: false, error: errorMessage, index: i });
      failCount++;
      logger.warn("Bulk create item failed", { correlationId, entity, index: i, error: error instanceof Error ? error : new Error(errorMessage) });
    }
  }

  return { results, successCount, failCount };
}

async function executeBulkUpdate(db: any, entity: string, items: Record<string, unknown>[], request: NextRequest, correlationId: string) {
  const results: Array<{ success: boolean; id?: string; error?: string; index: number }> = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const id = item.id as string;
    if (!id) {
      results.push({ success: false, error: "Missing id", index: i });
      failCount++;
      continue;
    }

    try {
      let updated: any = null;
      let entityId: string | null = id;

      switch (entity) {
        case "students": {
          const before = await db.student.findUnique({ where: { id }, select: { studentType: true, status: true, batchId: true, phone: true, email: true, city: true, school: true, className: true } });
          updated = await db.student.update({
            where: { id },
            data: {
              studentType: item.studentType === "SCHOLARSHIP" ? "SCHOLARSHIP" : item.studentType === "REGULAR" ? "REGULAR" : undefined,
              status: item.status === "ACTIVE" ? "ACTIVE" : item.status === "INACTIVE" ? "INACTIVE" : undefined,
              batchId: item.batchId ? String(item.batchId) : item.batchId === "" ? null : undefined,
              phone: item.phone ? String(item.phone) : undefined,
              email: item.email ? String(item.email) : undefined,
              city: item.city ? String(item.city) : undefined,
              school: item.school ? String(item.school) : undefined,
              className: item.className ? String(item.className) : undefined,
            },
          });
          await writeAuditLog(
            "bulk-api",
            "bulk@system",
            "BULK_UPDATE",
            "Student",
            entityId,
            before,
            updated,
            request,
            correlationId
          );
          break;
        }
        case "tests": {
          const before = await db.test.findUnique({ where: { id }, select: { status: true, accessType: true, price: true, isActive: true } });
          updated = await db.test.update({
            where: { id },
            data: {
              status: ["DRAFT", "SCHEDULED", "PUBLISHED", "LIVE", "COMPLETED"].includes(String(item.status).toUpperCase()) ? String(item.status).toUpperCase() : undefined,
              accessType: ["FREE", "PAID", "PRIVATE"].includes(String(item.accessType).toUpperCase()) ? String(item.accessType).toUpperCase() : undefined,
              price: typeof item.price === "number" ? item.price : undefined,
              isActive: typeof item.isActive === "boolean" ? item.isActive : undefined,
              publishedAt: item.status === "PUBLISHED" || item.status === "LIVE" ? new Date() : undefined,
            },
          });
          await writeAuditLog(
            "bulk-api",
            "bulk@system",
            "BULK_UPDATE",
            "Test",
            entityId,
            before,
            updated,
            request,
            correlationId
          );
          break;
        }
        case "books": {
          const before = await db.book.findUnique({ where: { id }, select: { isActive: true, visibleTo: true, order: true } });
          updated = await db.book.update({
            where: { id },
            data: {
              isActive: typeof item.isActive === "boolean" ? item.isActive : undefined,
              visibleTo: ["ALL", "REGULAR_ONLY"].includes(String(item.visibleTo).toUpperCase()) ? String(item.visibleTo).toUpperCase() : undefined,
              order: typeof item.order === "number" ? item.order : undefined,
            },
          });
          await writeAuditLog(
            "bulk-api",
            "bulk@system",
            "BULK_UPDATE",
            "Book",
            entityId,
            before,
            updated,
            request,
            correlationId
          );
          break;
        }
        case "batches": {
          const before = await db.batch.findUnique({ where: { id }, select: { status: true, facultyId: true } });
          updated = await db.batch.update({
            where: { id },
            data: {
              status: ["ACTIVE", "UPCOMING", "COMPLETED"].includes(String(item.status).toUpperCase()) ? String(item.status).toUpperCase() : undefined,
              facultyId: item.facultyId ? String(item.facultyId) : item.facultyId === "" ? null : undefined,
            },
          });
          await writeAuditLog(
            "bulk-api",
            "bulk@system",
            "BULK_UPDATE",
            "Batch",
            entityId,
            before,
            updated,
            request,
            correlationId
          );
          break;
        }
        default:
          throw new Error(`Unsupported entity for update: ${entity}`);
      }

      results.push({ success: true, id: entityId, index: i });
      successCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      results.push({ success: false, error: errorMessage, index: i });
      failCount++;
      logger.warn("Bulk update item failed", { correlationId, entity, index: i, error: error instanceof Error ? error : new Error(errorMessage) });
    }
  }

  return { results, successCount, failCount };
}

async function executeBulkDelete(db: any, entity: string, items: Record<string, unknown>[], request: NextRequest, correlationId: string) {
  const results: Array<{ success: boolean; id?: string; error?: string; index: number }> = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const id = item.id as string;
    if (!id) {
      results.push({ success: false, error: "Missing id", index: i });
      failCount++;
      continue;
    }

    try {
      switch (entity) {
        case "students": {
          const before = await db.student.findUnique({ where: { id }, select: { name: true, studentId: true } });
          await db.student.update({ where: { id }, data: { status: "INACTIVE" } });
          await writeAuditLog("bulk-api", "bulk@system", "BULK_DELETE", "Student", id, before, { status: "INACTIVE" }, request, correlationId);
          break;
        }
        case "tests": {
          const before = await db.test.findUnique({ where: { id }, select: { title: true } });
          await db.test.update({ where: { id }, data: { isActive: false, status: "ARCHIVED" } });
          await writeAuditLog("bulk-api", "bulk@system", "BULK_DELETE", "Test", id, before, { isActive: false, status: "ARCHIVED" }, request, correlationId);
          break;
        }
        case "books": {
          const before = await db.book.findUnique({ where: { id }, select: { title: true } });
          await db.book.update({ where: { id }, data: { isActive: false } });
          await writeAuditLog("bulk-api", "bulk@system", "BULK_DELETE", "Book", id, before, { isActive: false }, request, correlationId);
          break;
        }
        case "batches": {
          const before = await db.batch.findUnique({ where: { id }, select: { name: true } });
          await db.batch.update({ where: { id }, data: { status: "COMPLETED" } });
          await writeAuditLog("bulk-api", "bulk@system", "BULK_DELETE", "Batch", id, before, { status: "COMPLETED" }, request, correlationId);
          break;
        }
        default:
          throw new Error(`Unsupported entity for delete: ${entity}`);
      }

      results.push({ success: true, id, index: i });
      successCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      results.push({ success: false, error: errorMessage, index: i });
      failCount++;
      logger.warn("Bulk delete item failed", { correlationId, entity, index: i, error: error instanceof Error ? error : new Error(errorMessage) });
    }
  }

  return { results, successCount, failCount };
}

async function executeBulkStatusChange(db: any, entity: string, items: Record<string, unknown>[], request: NextRequest, correlationId: string) {
  const results: Array<{ success: boolean; id?: string; error?: string; index: number }> = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const id = item.id as string;
    const newStatus = item.status as string;
    if (!id || !newStatus) {
      results.push({ success: false, error: "Missing id or status", index: i });
      failCount++;
      continue;
    }

    try {
      let before: any = null;
      let updated: any = null;

      switch (entity) {
        case "students": {
          before = await db.student.findUnique({ where: { id }, select: { status: true, studentType: true } });
          if (!["ACTIVE", "INACTIVE"].includes(newStatus)) throw new Error("Invalid student status");
          updated = await db.student.update({ where: { id }, data: { status: newStatus as "ACTIVE" | "INACTIVE" } });
          break;
        }
        case "tests": {
          before = await db.test.findUnique({ where: { id }, select: { status: true, publishedAt: true } });
          if (!["DRAFT", "SCHEDULED", "PUBLISHED", "LIVE", "COMPLETED", "ARCHIVED"].includes(newStatus)) throw new Error("Invalid test status");
          updated = await db.test.update({
            where: { id },
            data: {
              status: newStatus,
              publishedAt: ["PUBLISHED", "LIVE"].includes(newStatus) ? new Date() : undefined,
            },
          });
          break;
        }
        case "batches": {
          before = await db.batch.findUnique({ where: { id }, select: { status: true } });
          if (!["ACTIVE", "UPCOMING", "COMPLETED"].includes(newStatus)) throw new Error("Invalid batch status");
          updated = await db.batch.update({ where: { id }, data: { status: newStatus as "ACTIVE" | "UPCOMING" | "COMPLETED" } });
          break;
        }
        case "faculty": {
          before = await db.faculty.findUnique({ where: { id }, select: { status: true } });
          if (!["ACTIVE", "INACTIVE"].includes(newStatus)) throw new Error("Invalid faculty status");
          updated = await db.faculty.update({ where: { id }, data: { status: newStatus as "ACTIVE" | "INACTIVE" } });
          break;
        }
        default:
          throw new Error(`Unsupported entity for statusChange: ${entity}`);
      }

      await writeAuditLog("bulk-api", "bulk@system", "BULK_UPDATE", entity, id, before, updated, request, correlationId);
      results.push({ success: true, id, index: i });
      successCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      results.push({ success: false, error: errorMessage, index: i });
      failCount++;
      logger.warn("Bulk statusChange item failed", { correlationId, entity, index: i, error: error instanceof Error ? error : new Error(errorMessage) });
    }
  }

  return { results, successCount, failCount };
}

export async function POST(request: NextRequest) {
  const requestLogger = logger.child({ route: "/api/admin/bulk", method: "POST" });
  const correlationId = requestLogger.getCorrelationId();

  const auth = await requireApiRole(request, ["ADMIN"]);
  if (!auth.ok) return fail(auth.error, auth.status);

  const db = getDb();
  if (!db) return dbNotConfigured("Bulk operations");

  let body: BulkOperation;
  try {
    const json = await request.json();
    const parsed = BulkOperationSchema.safeParse(json);
    if (!parsed.success) {
      return fail(`Invalid request: ${parsed.error.issues.map(e => e.message).join(", ")}`, 400);
    }
    body = parsed.data;
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const { operation, entity, items, options } = body;
  const continueOnError = options?.continueOnError ?? true;

  requestLogger.info("Bulk operation started", {
    correlationId,
    operation,
    entity,
    itemCount: items.length,
    adminId: auth.user.id,
  });

  let result: { results: any[]; successCount: number; failCount: number };

  try {
    const typedItems = items as Record<string, unknown>[];
    switch (operation) {
      case "create":
        result = await executeBulkCreate(db, entity, typedItems, request, correlationId);
        break;
      case "update":
        result = await executeBulkUpdate(db, entity, typedItems, request, correlationId);
        break;
      case "delete":
        result = await executeBulkDelete(db, entity, typedItems, request, correlationId);
        break;
      case "statusChange":
        result = await executeBulkStatusChange(db, entity, typedItems, request, correlationId);
        break;
      default:
        return fail("Unsupported operation", 400);
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    requestLogger.error("Bulk operation failed", { correlationId, error: err });
    return serverError("admin:bulk", err);
  }

  requestLogger.info("Bulk operation completed", {
    correlationId,
    operation,
    entity,
    successCount: result.successCount,
    failCount: result.failCount,
  });

  return ok({
    operation,
    entity,
    total: items.length,
    succeeded: result.successCount,
    failed: result.failCount,
    results: result.results,
  });
}