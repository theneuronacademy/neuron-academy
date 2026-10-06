// Phase 12 — deterministic question parser (no AI, no guessing).
// Pipeline: page texts → normalize → answer-key pass → question/option
// detection → confidence. Pure functions, fully unit-testable.

export type DetectedConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface ParsedOption {
  letter: "A" | "B" | "C" | "D" | "E";
  text: string;
}

export interface ParsedQuestion {
  /** 1-based number as printed, or ordinal when unnumbered. */
  number: number;
  stem: string;
  options: ParsedOption[];
  answer: "A" | "B" | "C" | "D" | "E" | null;
  answerSource: "key" | "inline" | null;
  confidence: DetectedConfidence;
  sourcePage: number;
  issues: string[];
  suggestedType: "MCQ" | "TRUE_FALSE";
}

export interface PageText {
  page: number;
  text: string;
}

const LETTERS = ["A", "B", "C", "D", "E"] as const;

const QUESTION_START =
  /^(?:Q\s?(\d{1,3})|Question\s+(\d{1,3})|(\d{1,3}))\s*[\.\)]\s*(.*)$/i;
// OCR often reads a leading "1." as "|." / "I." — treat as an unnumbered
// question start (ordinal assigned), never as a number.
const OCR_QUESTION_START = /^[|Il]\s*[\.\)]\s*(.{4,})$/;
// OCR often drops the dot ("A 13" for "A. 13") — accepted only when already
// inside an option run and the text after the letter is non-empty.
const OCR_OPTION_BARE = /^([A-E])\s+(\S.*)$/;
const OPTION_LINE = /^\(?([A-Ea-e1-5])\s*[\.\)]\s*(.*)$/;
const INLINE_ANSWER = /(?:^|\s)(?:Answer|Ans|Correct\s+Answer)\s*[:\-]\s*\(?([A-Ea-e])\)?\s*$/i;
const ANSWER_KEY_HEADER = /^\s*(answer\s*keys?|answers?)\s*[:\-]?\s*$/i;
const ANSWER_KEY_PAIR = /(?:^|[\s,;])(?:Q\s?)?(\d{1,3})\s*[\.\)\-:]\s*\(?([A-Ea-e])\)?(?=$|[\s,;])/g;
const TRUE_FALSE_WORDS = new Set(["true", "false", "yes", "no", "sahi", "galat"]);

function normalizeLetter(raw: string, position: number): "A" | "B" | "C" | "D" | "E" {
  const t = raw.trim().toUpperCase();
  if (/^[A-E]$/.test(t)) return t as "A" | "B" | "C" | "D" | "E";
  // Numeric options (1. 2. 3.) map by position.
  return LETTERS[Math.min(Math.max(position, 0), 4)];
}

interface RawBlock {
  number: number | null;
  lines: string[];
  page: number;
}

const INLINE_SPLIT = /(?=(?:^|\s)[A-Ea-e1-5]\s*[\.\)]\s*\S)/;

function splitInlineOptions(line: string): string[] {
  const parts = line.split(INLINE_SPLIT).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [line];
}

function splitBlocks(pages: PageText[]): { blocks: RawBlock[]; keyText: string[] } {
  const blocks: RawBlock[] = [];
  const keyText: string[] = [];
  let current: RawBlock | null = null;
  let inKeySection = false;
  let seenNumbered = false;

  const push = () => {
    if (current && current.lines.length > 0) blocks.push(current);
    current = null;
  };

  for (const { page, text } of pages) {
    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim().replace(/\s+/g, " ");
      if (!line) continue;
      if (ANSWER_KEY_HEADER.test(line)) {
        push();
        inKeySection = true;
        continue;
      }
      const qm = line.match(QUESTION_START);
      if (qm && !inKeySection) {
        const num = Number(qm[1] ?? qm[2] ?? qm[3]);
        const rest = (qm[4] ?? "").trim();
        // Numeric options (1. 2. 3.) are structurally identical to numbered
        // questions — disambiguate: a small number continuing a stem that has
        // no lettered options yet (or an ongoing numeric run) is an option.
        // Requires an already-numbered block so stray headers never merge.
        if (
          Number.isFinite(num) && num >= 1 && num <= 5 && rest.length < 80 &&
          current && current.number !== null && current.lines.length > 0 &&
          !current.lines.some((l) => /^[A-Ea-e]\s*[\.\)]/.test(l) || /^\([a-eA-E]\)/.test(l))
        ) {
          current.lines.push(line);
          continue;
        }
        push();
        seenNumbered = true;
        current = { number: Number.isFinite(num) ? num : null, lines: [], page };
        if (rest) current.lines.push(rest);
        continue;
      }
      const ocrQm = !inKeySection ? line.match(OCR_QUESTION_START) : null;
      if (ocrQm) {
        push();
        current = { number: null, lines: [ocrQm[1].trim()], page };
        continue;
      }
      if (inKeySection) {
        keyText.push(line);
        // A new numbered question after key pairs usually means content resumed.
        continue;
      }
      if (!current) {
        // Stray headers/titles before the first numbered question are
        // skipped (they would otherwise become phantom questions). After
        // numbering starts, a substantial line opens an unnumbered block.
        if (seenNumbered && line.length > 12) current = { number: null, lines: [line], page };
        continue;
      }
      current.lines.push(line);
    }
  }
  push();
  return { blocks, keyText };
}

function parseAnswerKey(keyText: string[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const line of keyText.join(" ")) {
    void line;
  }
  const joined = keyText.join(" ");
  let m: RegExpExecArray | null;
  ANSWER_KEY_PAIR.lastIndex = 0;
  while ((m = ANSWER_KEY_PAIR.exec(joined)) !== null) {
    map.set(Number(m[1]), m[2].toUpperCase());
  }
  return map;
}

function parseBlock(block: RawBlock, ordinal: number): { parsed: ParsedQuestion; inlineAnswer: string | null } {
  const issues: string[] = [];
  let inlineAnswer: string | null = null;
  const optionHits: { marker: string; text: string }[] = [];
  const stemParts: string[] = [];
  let inOptions = false;

  for (let line of block.lines) {
    const ansM = line.match(INLINE_ANSWER);
    if (ansM) {
      inlineAnswer = ansM[1].toUpperCase();
      line = line.slice(0, ansM.index).trim();
      if (!line) continue;
    }
    // Split "A. 3 B. 4 C. 5 D. 6" style lines BEFORE single matching,
    // otherwise the first marker swallows the rest of the line.
    const parts = splitInlineOptions(line);
    if (parts.length > 1) {
      for (const p of parts) {
        const pm = p.match(OPTION_LINE);
        if (pm) {
          inOptions = true;
          optionHits.push({ marker: pm[1], text: (pm[2] ?? "").trim() });
        } else if (!inOptions && p) {
          stemParts.push(p);
        } else if (p && optionHits.length > 0) {
          optionHits[optionHits.length - 1].text += " " + p;
        }
      }
      continue;
    }
    const om = line.match(OPTION_LINE);
    if (om) {
      inOptions = true;
      optionHits.push({ marker: om[1], text: (om[2] ?? "").trim() });
      continue;
    }
    // OCR tolerance: dropped dots ("A 13") accepted inside an option run.
    if (inOptions && optionHits.length > 0) {
      const bare = line.match(OCR_OPTION_BARE);
      if (bare) {
        optionHits.push({ marker: bare[1], text: bare[2].trim() });
        continue;
      }
    }
    if (inOptions && optionHits.length > 0) {
      optionHits[optionHits.length - 1].text += " " + line;
    } else {
      stemParts.push(line);
    }
  }

  const stem = stemParts.join(" ").trim();
  // Keep 2–5 options; extras beyond 5 indicate merged questions.
  const kept = optionHits.slice(0, 5);
  if (optionHits.length > 5) issues.push(`Found ${optionHits.length} option-like lines; kept first 5.`);
  const options: ParsedOption[] = kept.map((o, i) => ({ letter: normalizeLetter(o.marker, i), text: o.text.trim() }));
  const emptyOpts = options.filter((o) => !o.text).length;
  if (emptyOpts > 0) issues.push(`${emptyOpts} option(s) have empty text.`);

  if (!stem) issues.push("Missing question stem.");
  if (block.number === null) issues.push("Unnumbered question (ordinal assigned).");
  if (options.length < 2) issues.push("Fewer than 2 options detected.");

  const tfLooks =
    options.length === 2 &&
    options.every((o) => TRUE_FALSE_WORDS.has(o.text.toLowerCase().replace(/[^a-z]/g, "")));
  const suggestedType = tfLooks ? "TRUE_FALSE" : "MCQ";

  const number = block.number ?? ordinal;
  let confidence: DetectedConfidence = "LOW";
  if (stem && options.length >= 2 && block.number !== null) confidence = "MEDIUM";
  if (stem && options.length >= 2 && block.number !== null && options.every((o) => o.text)) confidence = "HIGH";

  return {
    parsed: {
      number,
      stem,
      options,
      answer: null, // resolved in second pass against the key / inline capture
      answerSource: inlineAnswer ? "inline" : null,
      confidence,
      sourcePage: block.page,
      issues,
      suggestedType,
    },
    inlineAnswer,
  };
}

export interface ParseResult {
  questions: ParsedQuestion[];
  stats: {
    detected: number;
    high: number;
    needsReview: number;
    withAnswer: number;
    missingAnswer: number;
    pages: number;
  };
}

export function parseQuestionsFromPages(pages: PageText[]): ParseResult {
  const { blocks, keyText } = splitBlocks(pages);
  const key = parseAnswerKey(keyText);
  const questions: ParsedQuestion[] = [];
  let ordinal = 0;

  for (const block of blocks) {
    ordinal += 1;
    const { parsed: q, inlineAnswer } = parseBlock(block, ordinal);
    if (!q.stem && q.options.length === 0) continue;
    // Prefer printed-number key match, fall back to ordinal position.
    const keyed = key.get(q.number) ?? key.get(ordinal) ?? null;
    if (keyed && /^[A-E]$/.test(keyed)) {
      const idx = LETTERS.indexOf(keyed as "A");
      if (idx >= 0 && idx < q.options.length) {
        q.answer = keyed as "A";
        q.answerSource = "key";
      } else {
        q.issues.push(`Answer key says ${keyed} but only ${q.options.length} option(s) found.`);
        if (q.confidence === "HIGH") q.confidence = "MEDIUM";
      }
    } else if (inlineAnswer && /^[A-E]$/.test(inlineAnswer)) {
      const idx = LETTERS.indexOf(inlineAnswer as "A");
      if (idx >= 0 && idx < q.options.length) {
        q.answer = inlineAnswer as "A";
        q.answerSource = "inline";
      } else {
        q.issues.push(`Inline answer ${inlineAnswer} exceeds detected options.`);
        if (q.confidence === "HIGH") q.confidence = "MEDIUM";
      }
    }
    if (!q.answer && q.confidence === "HIGH") q.confidence = "MEDIUM";
    if (q.answer && q.confidence === "MEDIUM" && q.issues.length === 0 && block.number !== null) {
      q.confidence = "HIGH";
    }
    questions.push(q);
  }

  const high = questions.filter((q) => q.confidence === "HIGH").length;
  const withAnswer = questions.filter((q) => q.answer).length;
  return {
    questions,
    stats: {
      detected: questions.length,
      high,
      needsReview: questions.length - high,
      withAnswer,
      missingAnswer: questions.length - withAnswer,
      pages: pages.length,
    },
  };
}
