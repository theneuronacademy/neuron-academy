"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, ChevronDown, ChevronUp } from "lucide-react";
import { SmartImage } from "@/lib/siteImages";
import type { AcademyResult } from "@/data/results";
import { resultCategory, type ResultKind } from "@/lib/resultLabels";
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
  key: string;
  label: string;
  kind: ResultKind;
  toppers: Topper[];
  years: string[];
}

/** Number of cards shown before "Show all" (2 rows on desktop, 3 on phones). */
const PREVIEW = 8;
const PREVIEW_PHONE = 6;

function buildGroups(rows: AcademyResult[]): Group[] {
  const groups = new Map<string, Group>();
  const seen = new Set<string>();
  for (const r of rows) {
    const cat = resultCategory(r.tag, r.exam);
    const name = titleCaseName(r.name);
    // The same student entered twice under one heading and year is shown once.
    const key = `${cat.key}|${name.toLowerCase()}|${r.year}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // A row with no score stores its achievement text in `score`; that text is the heading, not a score.
    const hasScore = r.score.trim() !== "" && r.score.trim() !== r.tag.trim();
    const g = groups.get(cat.key) ?? { key: cat.key, label: cat.label, kind: cat.kind, toppers: [], years: [] };
    g.toppers.push({ id: r.id, name, score: hasScore ? formatScore(r.score) : "", value: hasScore ? scoreValue(r.score) : null, year: r.year.trim(), image: r.image ?? "" });
    groups.set(cat.key, g);
  }
  const out = [...groups.values()];
  for (const g of out) {
    // Highest score first; then the most recent year; then rows with a photo; otherwise the admin's own order.
    g.toppers = g.toppers
      .map((t, i) => ({ t, i }))
      .sort((a, b) => (b.t.value ?? -1) - (a.t.value ?? -1) || Number(b.t.year || 0) - Number(a.t.year || 0) || Number(b.t.image !== "") - Number(a.t.image !== "") || a.i - b.i)
      .map((x) => x.t);
    g.years = [...new Set(g.toppers.map((t) => t.year).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  }
  // Largest group first.
  return out.sort((a, b) => b.toppers.length - a.toppers.length);
}

/** Headline figures worked out from the published rows themselves. */
function buildHighlights(groups: Group[]): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  const boards = groups.filter((g) => g.kind === "board");
  const scores = boards.flatMap((g) => g.toppers.map((t) => t.value).filter((v): v is number => v !== null));
  const best = boards
    .map((g) => ({ g, top: Math.max(...g.toppers.map((t) => t.value ?? 0)) }))
    .sort((a, b) => b.top - a.top)[0];
  if (best && best.top > 0) out.push({ value: `${best.top}%`, label: `Highest score, ${best.g.label}` });
  const ninety = scores.filter((v) => v >= 90).length;
  if (ninety > 0) out.push({ value: String(ninety), label: "Board results of 90% and above" });
  for (const exam of ["JMI", "AMU", "CM SHRI"]) {
    const n = groups.filter((g) => g.kind === "entrance" && g.label.startsWith(exam)).reduce((sum, g) => sum + g.toppers.length, 0);
    if (n > 0) out.push({ value: String(n), label: `${exam} entrance selections` });
  }
  return out.slice(0, 4);
}

function TopperCard({ t, group, hiddenOnPhone }: { t: Topper; group: Group; hiddenOnPhone: boolean }) {
  const selected = !t.score && group.kind === "entrance";
  return (
    <li className={hiddenOnPhone ? "hidden sm:block" : undefined}>
      <div className="group relative h-full overflow-hidden rounded-2xl border border-white/15 bg-white/5">
        <div className="relative aspect-[4/5] overflow-hidden bg-navy-800/60">
          {t.image ? (
            <SmartImage
              src={portraitPhoto(t.image)}
              alt={`${t.name}, ${t.score || (selected ? "selected" : "")} ${group.label} ${t.year}`.replace(/\s+/g, " ").trim()}
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
          ) : selected ? (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[12px] font-extrabold text-white shadow-card sm:text-[13px]">
              <BadgeCheck className="h-4 w-4" aria-hidden /> Selected
            </span>
          ) : null}
        </div>
        <div className="p-3">
          <p className="text-sm font-extrabold leading-snug text-white">{t.name}</p>
          <p className="mt-1 text-[11px] font-bold leading-snug text-silver-300">
            {group.label}{t.year ? ` · ${t.year}` : ""}
          </p>
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

/** Results grouped under clean headings, highest score first, with a year filter and "Show all". */
export function ToppersWall({ rows, demo = false }: { rows: AcademyResult[]; demo?: boolean }) {
  const groups = useMemo(() => buildGroups(rows), [rows]);
  const highlights = useMemo(() => buildHighlights(groups), [groups]);
  const [active, setActive] = useState(0);
  const [year, setYear] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (groups.length === 0) {
    return (
      <p className="mt-10 rounded-card border border-dashed border-white/20 p-8 text-center text-sm font-bold text-silver-300">
        No results published yet.
      </p>
    );
  }

  const group = groups[Math.min(active, groups.length - 1)];
  const inYear = year && group.years.includes(year) ? group.toppers.filter((t) => t.year === year) : group.toppers;
  const shown = expanded ? inYear : inYear.slice(0, PREVIEW);
  const canExpand = inYear.length > PREVIEW_PHONE;
  const chip = (on: boolean) =>
    on
      ? "rounded-full bg-brand-secondary px-4 py-2 text-[13px] font-extrabold text-navy-950"
      : "rounded-full border border-white/25 px-4 py-2 text-[13px] font-bold text-silver-200 transition hover:bg-white/10";

  return (
    <div className="mt-8">
      {highlights.length > 0 ? (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {highlights.map((h) => (
            <div key={h.label} className="rounded-2xl border border-white/15 bg-white/5 px-4 py-4">
              <dd className="text-2xl font-extrabold text-brand-secondary-300 sm:text-3xl">{h.value}</dd>
              <dt className="mt-1 text-[12px] font-bold leading-snug text-silver-200 sm:text-[13px]">{h.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}

      {groups.length > 1 ? (
        <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="group" aria-label="Filter results by exam">
          {groups.map((g, i) => (
            <button key={g.key} type="button" aria-pressed={i === active} onClick={() => { setActive(i); setYear(null); setExpanded(false); }} className={`shrink-0 ${chip(i === active)}`}>
              {g.label} <span className="opacity-70">({g.toppers.length})</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm font-extrabold tracking-wide text-brand-secondary-300">{group.label}</p>
      )}

      {group.years.length > 1 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filter results by year">
          <span className="text-[12px] font-bold tracking-wider text-silver-300">YEAR</span>
          {[null, ...group.years].map((y) => (
            <button
              key={y ?? "all"}
              type="button"
              aria-pressed={(year ?? null) === y}
              onClick={() => { setYear(y); setExpanded(false); }}
              className={(year ?? null) === y ? "rounded-full bg-white px-3 py-1 text-[12px] font-extrabold text-navy-950" : "rounded-full border border-white/25 px-3 py-1 text-[12px] font-bold text-silver-200 transition hover:bg-white/10"}
            >
              {y ?? "All"}
            </button>
          ))}
        </div>
      ) : null}

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {shown.map((t, i) => (
          <TopperCard key={t.id} t={t} group={group} hiddenOnPhone={!expanded && i >= PREVIEW_PHONE} />
        ))}
      </ul>

      {canExpand ? (
        <div className={inYear.length > PREVIEW ? "mt-6 text-center" : "mt-6 text-center sm:hidden"}>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-white/30 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
          >
            {expanded ? <>Show fewer <ChevronUp className="h-4 w-4" /></> : <>Show all {inYear.length} <ChevronDown className="h-4 w-4" /></>}
          </button>
        </div>
      ) : null}

      {demo ? <p className="mt-4 text-center text-[10px] font-bold tracking-widest text-silver-300">DEMO — VERIFY BEFORE PUBLISH</p> : null}
    </div>
  );
}
