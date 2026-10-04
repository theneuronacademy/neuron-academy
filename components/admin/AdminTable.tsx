"use client";

import { cn } from "@/lib/utils";

export interface AdminColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

export function AdminTable<T extends { id: string }>({
  columns,
  rows,
  emptyMessage = "No records found.",
}: {
  columns: AdminColumn<T>[];
  rows: T[];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-silver-300 bg-white p-10 text-center">
        <p className="text-sm font-extrabold text-navy-700">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-card border border-silver-200 bg-white shadow-card">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-silver-200 bg-silver-50 text-[11px] tracking-widest text-muted">
            {columns.map((c) => (
              <th key={c.key} className={cn("px-4 py-3 font-bold", c.className)}>
                {c.header.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-silver-100 last:border-0 hover:bg-silver-50/60">
              {columns.map((c) => (
                <td key={c.key} className={cn("px-4 py-3", c.className)}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
