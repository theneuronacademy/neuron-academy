import { randomUUID } from "crypto";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogContext {
  correlationId?: string;
  userId?: string;
  userRole?: string;
  ip?: string;
  userAgent?: string;
  route?: string;
  method?: string;
  durationMs?: number;
  statusCode?: number;
  error?: Error;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context: LogContext;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

class Logger {
  private correlationId: string | null = null;
  private baseContext: LogContext = {};

  setCorrelationId(id: string) {
    this.correlationId = id;
  }

  getCorrelationId(): string {
    if (!this.correlationId) {
      this.correlationId = randomUUID();
    }
    return this.correlationId;
  }

  clearCorrelationId() {
    this.correlationId = null;
  }

  setBaseContext(context: LogContext) {
    this.baseContext = { ...this.baseContext, ...context };
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
  }

  private formatEntry(level: LogLevel, message: string, context: LogContext = {}): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: {
        ...this.baseContext,
        ...context,
        correlationId: context.correlationId || this.correlationId || randomUUID(),
      },
    };
  }

  private output(entry: LogEntry) {
    const line = JSON.stringify(entry);
    if (entry.level === "error" || entry.level === "fatal") {
      console.error(line);
    } else if (entry.level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog("debug")) this.output(this.formatEntry("debug", message, context));
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog("info")) this.output(this.formatEntry("info", message, context));
  }

  warn(message: string, context?: LogContext) {
    if (this.shouldLog("warn")) this.output(this.formatEntry("warn", message, context));
  }

  error(message: string, context?: LogContext) {
    if (this.shouldLog("error")) this.output(this.formatEntry("error", message, context));
  }

  fatal(message: string, context?: LogContext) {
    if (this.shouldLog("fatal")) this.output(this.formatEntry("fatal", message, context));
  }

  child(context: LogContext): Logger {
    const child = new Logger();
    child.baseContext = { ...this.baseContext, ...context };
    child.correlationId = this.correlationId;
    return child;
  }

  withCorrelationId(correlationId: string): Logger {
    const child = new Logger();
    child.baseContext = { ...this.baseContext };
    child.correlationId = correlationId;
    return child;
  }
}

export const logger = new Logger();

export function createRequestLogger(request: Request, correlationId?: string): Logger {
  const id = correlationId || randomUUID();
  const url = new URL(request.url);
  return logger.withCorrelationId(id).child({
    route: url.pathname,
    method: request.method,
    ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
    userAgent: request.headers.get("user-agent") || "unknown",
  });
}

export function logApiRequest(
  request: Request,
  statusCode: number,
  durationMs: number,
  userId?: string,
  userRole?: string
) {
  const log = createRequestLogger(request);
  log.info("API request completed", {
    statusCode,
    durationMs,
    userId,
    userRole,
  });
}

export function logAuditEvent(
  adminId: string,
  adminEmail: string,
  action: string,
  entity: string,
  entityId: string | null,
  beforeData: unknown,
  afterData: unknown,
  correlationId: string,
  ip?: string,
  userAgent?: string,
  status: "SUCCESS" | "FAILED" = "SUCCESS",
  errorMessage?: string
) {
  logger.info("Admin audit event", {
    correlationId,
    adminId,
    adminEmail,
    action,
    entity,
    entityId,
    beforeData,
    afterData,
    ip,
    userAgent,
    status,
    errorMessage,
  });
}