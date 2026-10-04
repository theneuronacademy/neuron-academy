"use client";

// Real text-based PDF extraction (pdfjs-dist) + format-tolerant question
// parsing. Text-based PDFs only — scanned/image PDFs need the OCR provider
// (next phase). Math/unicode symbols are preserved, never stripped.

import type { ExtractedQuestion } from "@/services/questionExtraction";

const CONFIDENCE_THRESHOLD = 75;

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Extract raw text with pdfjs-dist; fall back to naive decode on failure. */
export async function extractTextFromPDF(file: File): Promise<{ text: string; pages: number }> {
  try {
    const pdfjs = await import("pdfjs-dist");
    const pdfjsLib = pdfjs as unknown as {
      getDocument: (args: { data: ArrayBuffer }) => { promise: Promise<PDFDoc> };
      GlobalWorkerOptions: { workerSrc: string };
    };
    interface PDFPage {
      getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
    }
    interface PDFDoc {
      numPages: number;
      getPage: (n: number) => Promise<PDFPage>;
      destroy: () => Promise<void>;
    }
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${"6.3.289"}/pdf.worker.min.mjs`;
    }
    const buf = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buf }).promise;
    const parts: string[] = [];
    const max = Math.min(doc.numPages, 60);
    for (let p = 1; p <= max; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      // pdf.js item transform ordering is roughly preserved via str join.
      const line = (content.items as Array<{ str?: string }>)
        .map((it) => it.str ?? "")
        .join(" ")
        .replace(/[ \t]+/g, " ");
      parts.push(`[Page ${p}]\n${line}`);
    }
    await doc.destroy().catch(() => undefined);
    const text = parts.join("\n").trim();
    if (text.replace(/\[Page \d+\]/g, "").trim().length < 30) {
      throw new Error("too-short");
    }
    return { text, pages: doc.numPages };
  } catch {
    // Fallback: naive decode — works for some text PDFs, else caller shows
    // "Unable to read this PDF" and offers demo mode.
    const buf = await file.arrayBuffer();
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    const cleaned = raw
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, " ")
      .replace(/ +/g, " ");
    return { text: cleaned.trim(), pages: 0 };
  }
}

// ---------- Question splitting ----------

const QUESTION_SPLIT = /(?:^|\n)\s*(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[.):\-–]\s+/g;
const OPTION_LINE = /^\s*(?:\(?([A-Da-d])\)?[\s.):\-–]+)(.+)$/;
const LETTER = "ABCD";

function splitAnswerKey(text: string): { body: string; keyText: string } {
  const m = text.search(/\n\s*(answers?\s*(key)?|answer\s*sheet|solutions?)\s*[:\-]?\s*\n/i);
  if (m === -1) return { body: text, keyText: "" };
  return { body: text.slice(0, m), keyText: text.slice(m) };
}

/** Parse "1-C", "1. C", "Q3: b", "Answer 2: A" style keys → map qNo → option idx. */
function parseAnswerKey(keyText: string): Map<number, number> {
  const map = new Map<number, number>();
  if (!keyText) return map;
  const re = /(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[:.)\-–]?\s*\(?([A-Da-d])\)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(keyText)) !== null) {
    const q = parseInt(m[1], 10);
    const idx = LETTER.indexOf(m[2].toUpperCase());
    if (q >= 1 && idx >= 0 && !map.has(q)) map.set(q, idx);
  }
  // Also "Answer: C" single-answer papers → applies to question 1 only if 1 question.
  return map;
}

function extractOptions(block: string): { stem: string; options: string[] } {
  const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const opts: string[] = [];
  const stemLines: string[] = [];
  let inOptions = false;

  for (const line of lines) {
    const m = line.match(OPTION_LINE);
    if (m && opts.length < 4) {
      const idx = LETTER.indexOf(m[1].toUpperCase());
      // Accept in-order-ish options; tolerate restart at A.
      if (idx === opts.length || (opts.length === 0 && idx >= 0 && idx <= 1)) {
        // Normalize order: if first marker is B, still accept as A-slot.
        opts.push(m[2].trim());
        inOptions = true;
        continue;
      }
      if (inOptions && opts.length < 4 && idx >= 0) {
        opts.push(m[2].trim());
        continue;
      }
    }
    if (!inOptions) stemLines.push(line);
    else if (opts.length < 4) {
      // Continuation of previous option (wrapped line).
      opts[opts.length - 1] += ` ${line}`;
    } else {
      stemLines.push(line);
    }
  }

  if (opts.length < 2) {
    // Inline fallback: "A. .. B. .. C. .. D. .." on one line.
    const inline = block.match(/A\s*[.):\-–]\s*([\s\S]+?)\s+B\s*[.):\-–]\s*([\s\S]+?)\s+C\s*[.):\-–]\s*([\s\S]+?)\s+D\s*[.):\-–]\s*([\s\S]+)/);
    if (inline) {
      const stem = block.slice(0, block.search(/A\s*[.):\-–]/)).replace(/\s+/g, " ").trim();
      return { stem, options: [inline[1].trim(), inline[2].trim(), inline[3].trim(), inline[4].trim()] };
    }
  }

  return { stem: stemLines.join(" ").replace(/\s+/g, " ").trim(), options: opts };
}

function guessDifficulty(stem: string): "Easy" | "Medium" | "Hard" {
  const s = stem.toLowerCase();
  if (/(matrix|determinant|integral|∫|lim|differential|probability|compound|successive)/.test(s) || stem.length > 220) return "Hard";
  if (stem.length < 90 && !/(not|except| assertion|reason)/.test(s)) return "Easy";
  return "Medium";
}

export function parseQuestionsFromText(rawText: string, sourceName: string): ExtractedQuestion[] {
  const text = rawText.replace(/\r\n?/g, "\n");
  const { body, keyText } = splitAnswerKey(text);
  const key = parseAnswerKey(keyText);

  const blocks: Array<{ no: number; block: string }> = [];
  let lastNo = -1;
  let lastIdx = 0;
  QUESTION_SPLIT.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = QUESTION_SPLIT.exec(body)) !== null) {
    const no = parseInt(m[1], 10);
    if (lastNo !== -1) {
      blocks.push({ no: lastNo, block: body.slice(lastIdx, m.index).trim() });
    }
    lastNo = no;
    lastIdx = m.index + m[0].length;
  }
  if (lastNo !== -1) blocks.push({ no: lastNo, block: body.slice(lastIdx).trim() });

  // If no numbered questions found, this PDF has no detectable questions.
  if (blocks.length === 0) return [];

  return blocks
    .filter((b) => b.block.length > 0)
    .map((b, i) => {
      const { stem, options } = extractOptions(b.block);
      const correctAnswer = key.has(b.no) ? (key.get(b.no) as number) : null;
      let confidence = 60;
      if (options.length === 4) confidence += 15;
      else if (options.length < 2) confidence -= 20;
      if (/[?]$/.test(stem) || /[+\-×÷=^√∫∑%α-ω]/.test(stem)) confidence += 10;
      if (correctAnswer !== null) confidence += 10;
      if (stem.length < 20) confidence -= 15;
      confidence = Math.max(5, Math.min(98, confidence));
      const needsReview = confidence < CONFIDENCE_THRESHOLD || correctAnswer === null || options.length < 4;
      // Pad options to 4 slots so the editor always shows A–D.
      const padded = [...options];
      while (padded.length < 4) padded.push("");
      return {
        id: uid("exq"),
        question: stem || `Question ${b.no} (text unclear — please edit)`,
        options: padded.slice(0, 4),
        correctAnswer: correctAnswer !== null && padded[correctAnswer] ? correctAnswer : correctAnswer,
        explanation: "",
        subject: "General",
        chapter: "Unassigned",
        difficulty: guessDifficulty(stem),
        source: `${sourceName}${i === 0 && keyText ? " (+answer key)" : ""}`,
        confidence,
        needsReview,
      } as ExtractedQuestion;
    });
}

export class PDFTextProvider {
  readonly name = "pdf-text" as const;
  async extractText(file: File) {
    return extractTextFromPDF(file);
  }
  async extractQuestions(file: File, sourceName: string): Promise<ExtractedQuestion[]> {
    const { text } = await extractTextFromPDF(file);
    return parseQuestionsFromText(text, sourceName);
  }
}

/** Demo-mode sample paper (Percentage) in a common PDF text layout — runs
 *  through the REAL parser so the client sees the genuine pipeline. */
export function samplePaperText(): string {
  const lines: string[] = ["Percentage Practice Set — Demo Paper", ""];
  const data: Array<[string, string[], string]> = [
    ["What is 25% of 640?", ["120", "140", "160", "180"], "C"],
    ["A number increased by 20% becomes 360. Find the original number.", ["280", "300", "320", "340"], "B"],
    ["If 40% of a number is 96, what is 75% of the same number?", ["150", "165", "180", "195"], "C"],
    ["Price of sugar rises by 25%. By what % must consumption reduce to keep expense same?", ["15%", "20%", "22%", "25%"], "B"],
    ["Two successive discounts of 10% and 20% equal a single discount of:", ["28%", "30%", "25%", "32%"], "A"],
    ["If x is 30% more than y, then y is what % less than x?", ["23.07%", "30%", "25%", "21.5%"], "A"],
    ["A salary of Rs. 50,000 is reduced by 10% and then increased by 10%. Net change?", ["No change", "1% decrease", "1% increase", "2% decrease"], "B"],
    ["Population of a town increases 5% yearly. From 40,000, population after 2 years?", ["44,000", "44,100", "44,200", "44,500"], "B"],
    ["A trader marks goods 40% above cost and gives 15% discount. Profit %?", ["19%", "21%", "25%", "17%"], "A"],
    ["Fresh fruit is 80% water; dry fruit is 20% water. From 100 kg fresh, dry fruit obtained?", ["20 kg", "25 kg", "30 kg", "35 kg"], "B"],
    ["What percent is 45 of 180?", ["20%", "22.5%", "25%", "30%"], "C"],
    ["72 is what % more than 60?", ["15%", "18%", "20%", "25%"], "C"],
  ];
  data.forEach(([q, opts,], i) => {
    lines.push(`${i + 1}. ${q}`);
    opts.forEach((o, j) => lines.push(`${"ABCD"[j]}. ${o}`));
    lines.push("");
  });
  lines.push("Answer Key");
  data.forEach(([, , a], i) => lines.push(`${i + 1}. ${a}`));
  return lines.join("\n");
}

export { CONFIDENCE_THRESHOLD };
