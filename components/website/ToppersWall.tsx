"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SmartImage } from "@/lib/siteImages";
import type { AcademyResult } from "@/data/results";
import { formatScore, initials, portraitPhoto, scoreValue, titleCaseName } from "@/lib/displayText";

interface Topper {
  id: string;
  name: string;
  score: string;
  value: number | null;
  year: string;
  image: string;
}

interface Group {
  label: string;
  toppers: Topper[];
}

/** Number of cards shown before "Show all" (2 rows on desktop, 3 on phones). */
const PREVIEW = 8;
const PREVIEW_PHONE = 6;

/** One label per kind of achievement, however the admin typed it. */
function groupLabel(r: AcademyResult): string {
  const tag = r.tag.trim();
  if (/\b(class\s*)?(10|x)(th)?\b.*board|board.*\b(10|x)(th)?\b/i.test(tag)) return "Class 10 Boards";
  if (/\b(class\s*)?(12|xii)(th)?\b.*board|board.*\b(12|xii)(th)?\b/i.test(tag)) return "Class 12 Boards";
  const text = tag || r.exam.trim();
  // "JMI/AMU/CM SHRI" and "JMI / AMU / CM Shri" are the same heading.
  return text.split("/").map((p) => p.trim().toUpperCase()).filter(Boolean).join(" / ") || "Achievements";
}

function buildGroups(rows: AcademyResult[]): Group[] {
  const groups = new Map<string, Topper[]>();
  const seen = new Set<string>();
  for (const r of rows) {
    const label = groupLabel(r);
    const name = titleCaseName(r.name);
    // The same student entered twice under one heading is shown once.
    const key = `${label}|${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // A row with no score stores its achievement text in `score`; that text is the heading, not a score.
    const hasScore = r.score.trim() !== "" && r.score.trim() !== r.tag.trim();
    const score = hasScore ? formatScore(r.score) : "";
    const list = groups.get(label) ?? [];
    list.push({ id: r.id, name, score, value: hasScore ? scoreValue(r.score) : null, year: r.year, image: r.image ?? "" });
    groups.set(label, list);
  }
  const out: Group[] = [];
  for (const [label, toppers] of groups) {
    // Highest score first; then rows with a photo; otherwise the admin's own order.
    const ranked = toppers
      .map((t, i) => ({ t, i }))
      .sort((a, b) => (b.t.value ?? -1) - (a.t.value ?? -1) || Number(b.t.image !== "") - Number(a.t.image !== "") || a.i - b.i)
      .map((x) => x.t);
    out.push({ label, toppers: ranked });
  }
  // Largest group first.
  return out.sort((a, b) => b.toppers.length - a.toppers.length);
}

function TopperCard({ t, hiddenOnPhone }: { t: Topper; hiddenOnPhone: boolean }) {
  return (
    <li className={hiddenOnPhone ? "hidden sm:block" : undefined}>
      <div className="group relative h-full overflow-hidden rounded-2xl border border-white/15 bg-white/5">
        <div className="relative aspect-[4/5] overflow-hidden bg-navy-800/60">
          {t.image ? (
            <SmartImage
              src={portraitPhoto(t.image)}
              alt={`${t.name}${t.score ? `, ${t.score}` : ""}`}
              className="absolute inset-0"
              imgClassName="h-full w-full object-cover object-top transition duration-500 group-hover:scale-105"
              fallback={<Initials name={t.name} />}
            />
          ) : (
            <Initials name={t.name} />
          )}
          {t.score ? (
            <span className="absolute bottom-2 left-2 rounded-lg bg-brand-secondary px-2.5 py-1 text-sm font-extrabold text-navy-950 shadow-card sm:text-base">
              {t.score}
            </span>
          ) : null}
        </div>
        <div className="p-3">
          <p className="text-sm font-extrabold leading-snug text-white">{t.name}</p>
          {t.year ? <p className="mt-0.5 text-[11px] font-bold tracking-wider text-silver-300">{t.year}</p> : null}
        </div>
      </div>
    </li>
  );
}

function Initials({ name }: { name: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-navy-800 to-brand-primary">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-white/10 text-xl font-extrabold text-white">
        {initials(name)}
      </span>
    </div>
  );
}

/** Toppers grouped by achievement, highest score first, with a short preview and "Show all". */
export function ToppersWall({ rows, demo = false }: { rows: AcademyResult[]; demo?: boolean }) {
  const groups = useMemo(() => buildGroups(rows), [rows]);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);

  if (groups.length === 0) {
    return (
      <p className="mt-10 rounded-card border border-dashed border-white/20 p-8 text-center text-sm font-bold text-silver-300">
        No results published yet.
      </p>
    );
  }

  const group = groups[Math.min(active, groups.length - 1)];
  const shown = expanded ? group.toppers : group.toppers.slice(0, PREVIEW);
  const canExpand = group.toppers.length > PREVIEW_PHONE;

  return (
    <div className="mt-8">
      {groups.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter results by achievement">
          {groups.map((g, i) => (
            <button
              key={g.label}
              type="button"
              aria-pressed={i === active}
              onClick={() => { setActive(i); setExpanded(false); }}
              className={
                i === active
                  ? "rounded-full bg-brand-secondary px-4 py-2 text-[13px] font-extrabold text-navy-950"
                  : "rounded-full border border-white/25 px-4 py-2 text-[13px] font-bold text-silver-200 transition hover:bg-white/10"
              }
            >
              {g.label} <span className="opacity-70">({g.toppers.length})</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm font-extrabold tracking-wide text-brand-secondary-300">{group.label}</p>
      )}

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {shown.map((t, i) => (
          <TopperCard key={t.id} t={t} hiddenOnPhone={!expanded && i >= PREVIEW_PHONE} />
        ))}
      </ul>

      {canExpand ? (
        <div className={group.toppers.length > PREVIEW ? "mt-6 text-center" : "mt-6 text-center sm:hidden"}>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-white/30 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
          >
            {expanded ? <>Show fewer <ChevronUp className="h-4 w-4" /></> : <>Show all {group.toppers.length} <ChevronDown className="h-4 w-4" /></>}
          </button>
        </div>
      ) : null}

      {demo ? <p className="mt-4 text-center text-[10px] font-bold tracking-widest text-silver-300">DEMO — VERIFY BEFORE PUBLISH</p> : null}
    </div>
  );
}
