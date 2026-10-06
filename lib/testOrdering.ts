// Phase 12 — server-side ordering engine (single source of truth).
// - Generation: pick N questions (SERIAL = stored order, RANDOM = shuffle),
//   assign display order.
// - Attempts: per-attempt question order + per-question option shuffles are
//   generated ONCE at attempt start and stored on the attempt (refresh-safe).
// - Delivery: paper assembly applies stored mappings, strips answer keys.
// - Evaluation: submitted display letters invert through the stored mapping.
// Pure functions (except randomness source) — unit-testable. Uses
// crypto-random shuffles; never relies on client ordering.

import { randomInt } from "node:crypto";

export type OrderMode = "SERIAL" | "RANDOM";

export function normalizeMode(v: unknown): OrderMode {
  return String(v ?? "SERIAL").toUpperCase() === "RANDOM" ? "RANDOM" : "SERIAL";
}

/** Fisher–Yates with crypto randomness. Returns a new array. */
export function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface OrderableQuestion {
  id: string;
  optionLetters: string[]; // original letters present, e.g. ["A","B","C","D"]
}

/** Display order for one question: original letters in shown sequence. */
export function shuffleOptions(letters: string[], mode: OrderMode): string[] {
  if (mode !== "RANDOM" || letters.length <= 1) return [...letters];
  let out = shuffle(letters);
  // Avoid the degenerate fixed point so RANDOM always changes something.
  if (out.every((l, i) => l === letters[i])) out = [...out.slice(1), out[0]];
  return out;
}

/** True when a stored per-question mapping is a valid permutation of present letters. */
export function isValidQuestionMap(stored: unknown, present: readonly string[]): stored is string[] {
  return (
    Array.isArray(stored) &&
    stored.length === present.length &&
    stored.length > 0 &&
    stored.every((l) => typeof l === "string" && (present as readonly string[]).includes(l)) &&
    new Set(stored).size === stored.length
  );
}

/** Present (non-empty) original letters for an option text array. */
export function presentLetters(options: (string | null)[]): string[] {
  return (["A", "B", "C", "D", "E"] as const).filter((l) => {
    const t = options["ABCDE".indexOf(l)];
    return t != null && String(t).trim() !== "";
  }) as string[];
}

/**
 * Build + store attempt mappings.
 * optionMap: { [questionId]: originalLettersInDisplayOrder }
 */
export function buildAttemptMappings(
  questions: OrderableQuestion[],
  questionMode: OrderMode,
  optionMode: OrderMode
): { questionOrder: string[]; optionMap: Record<string, string[]> } {
  const ordered = questionMode === "RANDOM" ? shuffle(questions) : [...questions];
  const optionMap: Record<string, string[]> = {};
  for (const q of ordered) {
    optionMap[q.id] = shuffleOptions(q.optionLetters, optionMode);
  }
  return { questionOrder: ordered.map((q) => q.id), optionMap };
}

/** Invert a display letter back to the original letter for one question. */
export function invertDisplayLetter(displayLetter: string, displayOrder: string[]): string | null {
  const idx = "ABCDE".indexOf(displayLetter.toUpperCase());
  if (idx < 0 || idx >= displayOrder.length) return null;
  return displayOrder[idx];
}

export interface PaperQuestion {
  id: string;
  questionText: string;
  questionType: string;
  /** Display-position-keyed options WITHOUT answer keys. */
  options: { display: string; text: string | null }[];
  marks: number;
  negativeMarks: number;
  order: number;
  // Original-position texts (backward compatible with optionA..D consumers).
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  optionE: string | null;
}

/**
 * Assemble the student paper: stored question order + stored option maps,
 * answer keys stripped. Falls back to stored question order with serial
 * options when no mappings exist (legacy attempts).
 */
export function assemblePaper(
  questions: {
    id: string;
    questionText: string;
    questionType: string;
    options: (string | null)[];
    marks: number;
    negativeMarks: number;
    order: number;
  }[],
  questionOrder: string[] | null,
  optionMap: Record<string, string[]> | null
): PaperQuestion[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const ids =
    questionOrder && questionOrder.length > 0
      ? questionOrder.filter((id) => byId.has(id))
      : [...questions].sort((a, b) => a.order - b.order).map((q) => q.id);
  // Include any questions missing from a stale mapping (never drop content).
  for (const q of questions) if (!ids.includes(q.id)) ids.push(q.id);

  return ids.map((id, i) => {
    const q = byId.get(id);
    if (!q) {
      throw new Error("Ordering invariant violated: missing question.");
    }
    // Present (non-empty) original letters — gaps handled positionally.
    const present = presentLetters(q.options);
    const stored = optionMap?.[id];
    const displayOrder = isValidQuestionMap(stored, present) ? stored : [...present];
    const at = (letter: string): string | null => {
      const i = "ABCDE".indexOf(letter);
      return i >= 0 && i < q.options.length ? (q.options[i] ?? null) : null;
    };
    return {
      id: q.id,
      questionText: q.questionText,
      questionType: q.questionType,
      options: displayOrder.map((orig, di) => ({
        display: "ABCDE"[di],
        text: at(orig),
      })),
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      order: i,
      optionA: at("A"),
      optionB: at("B"),
      optionC: at("C"),
      optionD: at("D"),
      optionE: q.options.length > 4 ? at("E") : null,
    };
  });
}
