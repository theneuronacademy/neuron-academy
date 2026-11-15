// One clean heading per kind of result, however it was typed in the admin
// panel: "JMI CLAS 9th ENTRANCE", "JMI CLASS 9th  ENTRANCE" and
// "jmi class IX entrance" are all "JMI Class 9 Entrance".
// Used by the homepage results wall and by the admin results page, so the
// admin sees exactly the heading the public will see.

export type ResultKind = "board" | "entrance" | "other";

export interface ResultCategory {
  /** Stable key for grouping. */
  key: string;
  /** Heading shown to visitors. */
  label: string;
  kind: ResultKind;
}

const ROMAN: Record<string, number> = { vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };

/** The class number mentioned in the text ("9th", "Class IX", "CLAS 9"), or null. */
function classNumber(text: string): number | null {
  const m =
    text.match(/\bcl[a-z]*\.?[\s-]*(\d{1,2}|xii|xi|x|ix|viii|vii|vi)(?:st|nd|rd|th)?\b/i) ??
    text.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/i);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : ROMAN[m[1].toLowerCase()];
  return n >= 1 && n <= 12 ? n : null;
}

function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\b(Jmi|Amu|Cbse|Neet|Jee|Cuet|Cm Shri)\b/g, (w) => w.toUpperCase())
    .replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (_, d: string, s: string) => d + s.toLowerCase());
}

const ENTRANCES: Array<{ name: string; test: RegExp }> = [
  { name: "JMI", test: /\bjmi\b|jamia/i },
  { name: "AMU", test: /\bamu\b|aligarh/i },
  { name: "CM SHRI", test: /cm[\s-]*shri/i },
];

/**
 * The heading a result belongs under. `achievement` is the admin's free
 * text; `exam` is the dropdown value, used when the text does not name the
 * exam itself.
 */
export function resultCategory(achievement: string, exam = ""): ResultCategory {
  const text = achievement.trim();
  const both = `${text} ${exam}`;
  const cls = classNumber(text);

  if (/\bboards?\b|\bcbse\b/i.test(text)) {
    return cls ? { key: `board-${cls}`, label: `Class ${cls} Boards`, kind: "board" } : { key: "board", label: "Board Exams", kind: "board" };
  }
  for (const e of ENTRANCES) {
    if (e.test.test(both)) {
      const slug = e.name.toLowerCase().replace(/\s+/g, "-");
      return cls ? { key: `${slug}-${cls}`, label: `${e.name} Class ${cls} Entrance`, kind: "entrance" } : { key: slug, label: `${e.name} Entrance`, kind: "entrance" };
    }
  }
  if (/\bneet\b/i.test(both)) return { key: "neet", label: "NEET", kind: "entrance" };
  if (/\bjee\b/i.test(both)) return /adv/i.test(both) ? { key: "jee-advanced", label: "JEE Advanced", kind: "entrance" } : { key: "jee-main", label: "JEE Main", kind: "entrance" };
  if (/\bcuet\b/i.test(both)) return { key: "cuet", label: "CUET", kind: "entrance" };
  const label = tidy(text || exam) || "Achievements";
  return { key: `other-${label.toLowerCase()}`, label, kind: "other" };
}

/** Ready-made result types for the admin form, so headings are typed the same way every time. */
export const RESULT_PRESETS: Array<{ label: string; achievement: string; exam: string }> = [
  { label: "Class 10 Boards", achievement: "Class 10 Board", exam: "Others" },
  { label: "Class 12 Boards", achievement: "Class 12 Board", exam: "Others" },
  { label: "JMI Class 6 Entrance", achievement: "JMI Class 6 Entrance", exam: "JMI" },
  { label: "JMI Class 9 Entrance", achievement: "JMI Class 9 Entrance", exam: "JMI" },
  { label: "JMI Class 11 Entrance", achievement: "JMI Class 11 Entrance", exam: "JMI" },
  { label: "AMU Class 6 Entrance", achievement: "AMU Class 6 Entrance", exam: "AMU" },
  { label: "AMU Class 9 Entrance", achievement: "AMU Class 9 Entrance", exam: "AMU" },
  { label: "AMU Class 11 Entrance", achievement: "AMU Class 11 Entrance", exam: "AMU" },
  { label: "CM SHRI Class 6 Entrance", achievement: "CM SHRI Class 6 Entrance", exam: "CM SHRI" },
  { label: "CM SHRI Class 9 Entrance", achievement: "CM SHRI Class 9 Entrance", exam: "CM SHRI" },
  { label: "CM SHRI Class 11 Entrance", achievement: "CM SHRI Class 11 Entrance", exam: "CM SHRI" },
  { label: "NEET", achievement: "NEET", exam: "NEET" },
  { label: "JEE Main", achievement: "JEE Main", exam: "JEE Main" },
  { label: "JEE Advanced", achievement: "JEE Advanced", exam: "JEE Advanced" },
];
