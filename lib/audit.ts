import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/prisma";
import { logger, logAuditEvent, createRequestLogger } from "@/lib/logger";
import { requireApiRole } from "@/lib/server-auth";

export interface AuditOptions {
  entity: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "BULK_CREATE" | "BULK_UPDATE" | "BULK_DELETE" | "STATUS_CHANGE" | "PERMISSION_GRANT" | "PERMISSION_REVOKE" | "EXPORT" | "IMPORT";
  getEntityId?: (body: Record<string, unknown>, response: NextResponse) => string | null;
  getBeforeData?: (request: NextRequest) => Promise<Record<string, unknown> | null>;
  getAfterData?: (response: NextResponse) => Promise<Record<string, unknown> | null>;
  sensitiveFields?: string[];
}

function sanitizeData(
  data: Record<string, unknown> | null,
  sensitiveFields: string[] = []
): Record<string, unknown> | null {
  if (!data) return null;
  const sanitized = { ...data };
  const defaultSensitive = [
    "password",
    "passwordHash",
    "otpHash",
    "authSecretHash",
    "secret",
    "token",
    "apiKey",
    "privateKey",
  ];
  const fields = [...defaultSensitive, ...sensitiveFields];
  for (const field of fields) {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  }
  return sanitized;
}

export function withAudit(
  handler: (request: NextRequest, context: { auditLog: (data: { entityId: string; beforeData?: Record<string, unknown>; afterData?: Record<string, unknown>; status?: "SUCCESS" | "FAILED"; errorMessage?: string }) => Promise<void> }) => Promise<NextResponse>,
  options: AuditOptions
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestLogger = createRequestLogger(request);
    const correlationId = requestLogger.getCorrelationId();

    const auth = await requireApiRole(request, ["ADMIN"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const adminUser = auth.user;
    let requestBody: Record<string, unknown> = {};
    try {
      const cloned = request.clone();
      requestBody = await cloned.json().catch(() => ({}));
    } catch {
      requestBody = {};
    }

    let beforeData: Record<string, unknown> | null = null;
    if (options.getBeforeData) {
      try {
        beforeData = await options.getBeforeData(request);
      } catch {
        beforeData = null;
      }
    }

    const auditLog = async (data: {
      entityId: string;
      beforeData?: Record<string, unknown>;
      afterData?: Record<string, unknown>;
      status?: "SUCCESS" | "FAILED";
      errorMessage?: string;
    }) => {
      try {
        const db = getDb();
        if (db) {
          await db.adminAuditLog.create({
            data: {
              adminId: adminUser.id,
              adminEmail: adminUser.email,
              action: options.action,
              entity: options.entity,
              entityId: data.entityId,
              beforeData: sanitizeData(data.beforeData || beforeData, options.sensitiveFields),
              afterData: sanitizeData(data.afterData, options.sensitiveFields),
              ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
              userAgent: request.headers.get("user-agent") || "unknown",
              correlationId,
              status: data.status || "SUCCESS",
              errorMessage: data.errorMessage,
            },
          });
        }
      } catch (auditError) {
        logger.error("Failed to write audit log", {
          correlationId,
          error: auditError,
          entity: options.entity,
          action: options.action,
        });
      }

      logAuditEvent(
        adminUser.id,
        adminUser.email,
        options.action,
        options.entity,
        data.entityId,
        sanitizeData(data.beforeData || beforeData, options.sensitiveFields),
        sanitizeData(data.afterData, options.sensitiveFields),
        correlationId,
        request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        request.headers.get("user-agent") || "unknown",
        data.status || "SUCCESS",
        data.errorMessage
      );
    };

    const wrappedHandler = async (): Promise<NextResponse> => {
      return handler(request, { auditLog });
    };

    try {
      const response = await wrappedHandler();
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      requestLogger.error("API handler threw error", { correlationId, error: errorMessage });
      throw error;
    }
  };
}

export async function writeAuditLog(
  adminId: string,
  adminEmail: string,
  action: string,
  entity: string,
  entityId: string | null,
  beforeData: Record<string, unknown> | null,
  afterData: Record<string, unknown> | null,
  request: NextRequest,
  correlationId: string,
  status: "SUCCESS" | "FAILED" = "SUCCESS",
  errorMessage?: string
) {
  try {
    const db = getDb();
    if (db) {
      await db.adminAuditLog.create({
        data: {
          adminId,
          adminEmail,
          action,
          entity,
          entityId,
          beforeData: sanitizeData(beforeData),
          afterData: sanitizeData(afterData),
          ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
          userAgent: request.headers.get("user-agent") || "unknown",
          correlationId,
          status,
          errorMessage,
        },
      });
    }
  } catch (auditError) {
    logger.error("Failed to write audit log", {
      correlationId,
      error: auditError,
      entity,
      action,
    });
  }

  logAuditEvent(
    adminId,
    adminEmail,
    action,
    entity,
    entityId,
    sanitizeData(beforeData),
    sanitizeData(afterData),
    correlationId,
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
    request.headers.get("user-agent") || "unknown",
    status,
    errorMessage
  );
}