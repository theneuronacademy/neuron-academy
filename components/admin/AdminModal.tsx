"use client";

import { X } from "lucide-react";

export function AdminModal({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-navy-800/60" onClick={onClose} />
      <div className={`relative w-full ${wide ? "max-w-3xl" : "max-w-lg"} overflow-hidden rounded-card bg-white shadow-card-hover`}>
        <div className="flex items-center justify-between border-b border-silver-200 px-5 py-4">
          <h3 className="text-[15px] font-extrabold text-navy-700">{title}</h3>
          <button onClick={onClose} aria-label="Close dialog" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-silver-100 sm:h-8 sm:w-8">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function AdminDrawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-navy-800/60" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-card-hover">
        <div className="flex items-center justify-between border-b border-silver-200 px-5 py-4">
          <h3 className="text-[15px] font-extrabold text-navy-700">{title}</h3>
          <button onClick={onClose} aria-label="Close panel" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-silver-100 sm:h-8 sm:w-8">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
