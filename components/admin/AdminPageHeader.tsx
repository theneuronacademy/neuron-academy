"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export function AdminPageHeader({
  title,
  description,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionIcon?: LucideIcon;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-2xl">
        <h2 className="text-xl font-extrabold tracking-tight text-navy-700">{title}</h2>
        {description ? <p className="mt-1 text-[13px] font-medium text-muted">{description}</p> : null}
      </div>
      <div className="flex gap-2">
        {secondaryLabel && onSecondary ? (
          <Button variant="outline" size="sm" onClick={onSecondary} className="px-5 py-3 sm:px-3 sm:py-1.5">
            {secondaryLabel}
          </Button>
        ) : null}
        {actionLabel && onAction ? (
          <Button variant="primary" size="sm" onClick={onAction} className="px-5 py-3 sm:px-3 sm:py-1.5">
            {ActionIcon ? <ActionIcon className="h-4 w-4" /> : null}
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function QuickAction({
  icon: Icon,
  label,
  desc,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  desc: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-card border border-silver-200 bg-white p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <span className="rounded-xl bg-navy-700 p-2.5 text-white">
        <Icon className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-sm font-extrabold text-navy-700">{label}</span>
        <span className="block text-[12px] font-medium text-muted">{desc}</span>
      </span>
    </button>
  );
}
