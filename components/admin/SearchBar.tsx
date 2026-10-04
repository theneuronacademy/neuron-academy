"use client";

import { Search } from "lucide-react";

export function SearchBar({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm sm:max-w-xs">
      <Search className="h-4 w-4 shrink-0 text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-transparent outline-none placeholder:text-muted/70"
      />
    </label>
  );
}

export function FilterBar({
  options,
  value,
  onChange,
  ariaLabel = "Filter",
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-[13px] font-bold text-navy-700 outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function AdminToolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}
