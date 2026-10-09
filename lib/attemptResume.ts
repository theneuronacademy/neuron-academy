// Attempt resume helpers (pure, server + client safe).
// A refresh must never reset the clock or wipe answers: the server attempt
// row (startedAt + saved answers) is authoritative. The client derives a
// deadline from the SERVER clock (serverNow returned with the attempt) so a
// manipulated or skewed client clock cannot extend the test.

export type HydratedAnswers = Record<string, string | null>;

const DISPLAY_LETTERS = ["A", "B", "C", "D", "E"] as const;

/** Keep only well-formed saved answers (questionId -> A-E display letter).
 * Anything else (null, missing, out-of-range) means unanswered. */
export function hydrateAnswers(raw: unknown): HydratedAnswers {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: HydratedAnswers = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== "string" || k.length === 0 || k.length > 100) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && (DISPLAY_LETTERS as readonly string[]).includes(v)) {
      out[k] = v;
    }
  }
  return out;
}

function toMs(v: string | Date | null | undefined): number | null {
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v === "string" && v) {
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/**
 * Whole seconds remaining on an attempt, measured on the SERVER clock:
 * durationMin*60 minus elapsed since startedAt as seen by serverNow.
 * Returns null when the inputs are unusable (caller must fail closed).
 * May be <= 0 — that means expired; the caller must submit, not continue.
 */
export function remainingSeconds(opts: {
  startedAt: string | Date | null | undefined;
  durationMin: number;
  serverNow: string | Date | null | undefined;
}): number | null {
  const { durationMin } = opts;
  if (!Number.isFinite(durationMin) || durationMin <= 0) return null;
  const start = toMs(opts.startedAt);
  const now = toMs(opts.serverNow);
  if (start === null || now === null) return null;
  return Math.floor(durationMin * 60 - (now - start) / 1000);
}

/** True when the attempt must not continue (expired at or past deadline). */
export function isAttemptExpired(remaining: number | null): boolean {
  return remaining === null || remaining <= 0;
}

/** Maximum answers accepted in one autosave (matches paper `take: 500`). */
export const AUTOSAVE_MAX_ANSWERS = 500;

export interface SanitizedAutosave {
  /** questionId -> A-E letter or explicit null (cleared). Unknown keys dropped. */
  clean: Record<string, string | null>;
  /** Keys rejected as foreign/malformed (safe to report: opaque IDs only). */
  rejected: string[];
}

/**
 * Validate an autosave payload against the test's real question IDs.
 * Unknown question IDs and non-letter values are rejected (listed) rather
 * than stored — a client can never inject answers for foreign questions or
 * corrupt the row with malformed values. Explicit null means "cleared" and
 * is kept, matching submit semantics (absent/null = unanswered).
 */
export function sanitizeAutosaveAnswers(questionIds: string[], raw: unknown): SanitizedAutosave {
  const clean: Record<string, string | null> = {};
  const rejected: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { clean, rejected };
  const valid = new Set(questionIds.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 100));
  let kept = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (kept >= AUTOSAVE_MAX_ANSWERS) break;
    if (!valid.has(k)) {
      if (k.length > 0 && k.length <= 100) rejected.push(k);
      continue;
    }
    if (v === null || v === undefined) {
      clean[k] = null;
      kept += 1;
      continue;
    }
    if (typeof v === "string" && (DISPLAY_LETTERS as readonly string[]).includes(v)) {
      clean[k] = v;
      kept += 1;
      continue;
    }
    rejected.push(k);
  }
  return { clean, rejected };
}

/**
 * Client-side deadline (ms epoch) matching the server remaining time.
 * Computed once from server values at begin/resume; the countdown only
 * reads the local clock against this fixed point, so refresh recomputes
 * from the server instead of restarting the duration.
 */
export function deadlineFromRemaining(remainingSec: number): number {
  return Date.now() + Math.max(0, remainingSec) * 1000;
}
