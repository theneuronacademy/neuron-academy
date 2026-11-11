// Presentation helpers for admin-entered people data (faculty, toppers).
// They only tidy how text is shown — the stored records are never changed.

const ACRONYMS = new Set(["PGT", "TGT", "PRT", "SST", "JMI", "AMU", "NEET", "JEE", "CBSE", "CUET", "CS", "CA", "BA", "MA", "LLB"]);

function capWord(w: string): string {
  if (w === "") return w;
  if (ACRONYMS.has(w.toUpperCase())) return w.toUpperCase();
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/** "HelAL anwar" → "Helal Anwar", "SAMEER KHAN" → "Sameer Khan". */
export function titleCaseName(raw: string): string {
  return raw.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

/** "Arshad - Commerce" / "Nuzhat Shaheen  + Social science, English" → the person's name only. */
export function cleanFacultyName(raw: string): string {
  const namePart = raw.split(/\s+[-–—+|]\s*/)[0] || raw;
  return titleCaseName(namePart);
}

/** "COMMERCE" / "Social science" → "Commerce" / "Social Science". */
export function titleCaseLabel(raw: string): string {
  return raw.trim().split(/\s+/).map(capWord).join(" ");
}

/** "3+ YEAR" / "5 Years" / "3-4 years" → "3+ years" / "5 years" / "3–4 years". */
export function formatExperience(raw: string): string {
  const m = raw.trim().match(/^(\d+)\s*(?:[-–]\s*(\d+))?\s*(\+)?\s*(?:years?|yrs?)?\.?$/i);
  if (!m) return raw.trim();
  const [, a, b, plus] = m;
  const unit = !b && !plus && a === "1" ? "year" : "years";
  return `${a}${b ? `–${b}` : ""}${plus ? "+" : ""} ${unit}`;
}

/** Tidy spacing and shouting in a designation without changing its meaning. */
export function tidyDesignation(raw: string): string {
  let s = raw.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/\s+,/g, ",").replace(/(\S)\(/g, "$1 (").trim();
  s = s.replace(/\bupto\b/gi, "up to");
  return s
    .split(" ")
    .map((w) => {
      const core = w.replace(/[^A-Za-z]/g, "");
      if (core === "") return w;
      if (ACRONYMS.has(core.toUpperCase())) return w.replace(core, core.toUpperCase());
      // Only re-case words typed fully in capitals or fully in lower case.
      if (core === core.toUpperCase() && core.length > 1) return w.replace(core, core.charAt(0) + core.slice(1).toLowerCase());
      return w;
    })
    .join(" ");
}

/** "91.6" → "91.6%"; anything non-numeric is returned unchanged. */
export function formatScore(raw: string): string {
  const s = raw.trim();
  return /^\d{1,3}(\.\d+)?$/.test(s) ? `${s}%` : s;
}

/** Numeric value of a score such as "95.6%" (for sorting); null when it has none. */
export function scoreValue(raw: string): number | null {
  const m = raw.trim().match(/^(\d{1,3}(?:\.\d+)?)\s*%?$/);
  return m ? Number(m[1]) : null;
}

/** Up to two initials for a photo placeholder. */
export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
}

/**
 * Cloudinary delivery sizing: serve a face-centred crop at the size the card
 * needs, in a modern format, instead of the multi-megabyte original upload.
 * Non-Cloudinary URLs (and ones that already carry a transformation) pass through.
 */
export function portraitPhoto(url: string, width = 480, height = 600): string {
  const marker = "/image/upload/";
  if (!url.includes("res.cloudinary.com") || !url.includes(marker)) return url;
  const [head, tail] = url.split(marker);
  if (!/^v\d+\//.test(tail)) return url;
  return `${head}${marker}f_auto,q_auto,c_fill,g_face,w_${width},h_${height}/${tail}`;
}

/** Consistent presentation of one faculty record's text fields. */
export function presentFaculty<T extends { name: string; designation: string; subject: string; experience: string }>(m: T): T {
  return {
    ...m,
    name: cleanFacultyName(m.name),
    designation: tidyDesignation(m.designation),
    subject: titleCaseLabel(m.subject),
    experience: formatExperience(m.experience),
  };
}
