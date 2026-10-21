"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { designSystem, type ButtonVariant, type ButtonSize, type CardVariant, type InputVariant, type BadgeVariant, type PortalTheme } from "@/lib/design-system";

const { colors, typography, elevation, radius, transition } = designSystem;

// ---------------------------------------------------------------------------
// BUTTON — Metallic variants with portal awareness
// ---------------------------------------------------------------------------

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  portal?: PortalTheme;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export function Button({
  variant = "primary",
  size = "md",
  portal = "public",
  loading = false,
  icon,
  iconPosition = "left",
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const theme = designSystem.colors.portal[portal];

  const base = cn(
    "inline-flex items-center justify-center gap-2 font-bold transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:pointer-events-none",
    "cta-bounce",
    "rounded-xl"
  );

  const variants: Record<ButtonVariant, string> = {
    primary: `bg-[${theme.primary}] text-white hover:bg-[${theme.primaryHover}] shadow-[${elevation.metallic[portal === "student" ? "champagne" : portal === "faculty" ? "steel" : "platinum"]}]`,
    secondary: `bg-[${theme.accent}] text-white hover:bg-[${theme.accentHover}] shadow-[${elevation.metallic[portal === "student" ? "champagne" : portal === "faculty" ? "steel" : "platinum"]}]`,
    outline: `border-2 border-[${theme.border}] bg-transparent text-[${theme.text}] hover:bg-[${theme.primaryLight}] hover:border-[${theme.primary}]`,
    ghost: `text-[${theme.text}] hover:bg-[${theme.surfaceAlt}]`,
    metallic: `bg-gradient-to-r from-[${theme.primary}] to-[${theme.primaryHover}] text-white shadow-[${elevation.metallic[portal === "student" ? "champagne" : portal === "faculty" ? "steel" : "platinum"]}]`,
    accent: `bg-[${theme.accent}] text-white hover:bg-[${theme.accentHover}] shadow-[${elevation.metallic[portal === "student" ? "champagne" : portal === "faculty" ? "steel" : "platinum"]}]`,
    destructive: `bg-red-600 text-white hover:bg-red-700 shadow-[0_4px_20px_-2px_rgb(220_38_38/0.3)]`,
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-xs gap-1",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2",
    xl: "px-8 py-4 text-lg gap-3",
  };

  const iconNode = icon ? (
    <span className="flex-shrink-0" aria-hidden="true">{icon}</span>
  ) : null;

  return (
    <button
      className={cn(
        base,
        variants[variant],
        sizes[size],
        loading && "cursor-wait",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      ) : iconPosition === "left" ? iconNode : null}
      {children}
      {iconPosition === "right" && !loading ? iconNode : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// STATUS BADGE — Metallic tones
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  tone?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export function StatusBadge({ tone = "default", children, className, dot = false }: StatusBadgeProps) {
  const tones: Record<BadgeVariant, string> = {
    default: "bg-silver-50 text-muted border-silver-200",
    primary: "bg-navy-50 text-navy-700 border-navy-100",
    secondary: "bg-teal-50 text-teal-700 border-teal-100",
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    error: "bg-rose-50 text-rose-700 border-rose-100",
    metallic: "bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 border-slate-200",
    teal: "bg-teal-50 text-teal-700 border-teal-100",
    navy: "bg-navy-50 text-navy-700 border-navy-100",
    red: "bg-rose-50 text-rose-700 border-rose-100",
    silver: "bg-silver-50 text-silver-700 border-silver-200",
  };

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-widest",
      "animate-fade-in",
      tones[tone],
      className
    )}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" aria-hidden="true" />}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// CARDS — Metallic surface variants
// ---------------------------------------------------------------------------

interface CardProps {
  variant?: CardVariant;
  className?: string;
  children: React.ReactNode;
  portal?: PortalTheme;
  hover?: boolean;
}

export function Card({ variant = "default", className, children, portal = "public", hover = true }: CardProps) {
  const theme = designSystem.colors.portal[portal];

  const variants: Record<CardVariant, string> = {
    default: `bg-white border border-silver-200 shadow-[${elevation.level2}]`,
    elevated: `bg-white border border-silver-100 shadow-[${elevation.level3}]`,
    outlined: `bg-transparent border-2 border-silver-300`,
    metallic: `bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-[${elevation.metallic.platinum}]`,
    glass: `bg-white/80 backdrop-blur-md border border-white/20 shadow-[${elevation.level3}]`,
  };

  const hoverStyles = hover
    ? "hover:shadow-[0_20px_25px_-5px_rgb(0_0_0/0.06),_0_8px_10px_-6px_rgb(0_0_0/0.04)] hover:-translate-y-0.5 transition-all duration-300"
    : "";

  return (
    <div className={cn(
      "rounded-2xl overflow-hidden transition-all duration-300",
      variants[variant],
      hoverStyles,
      className
    )}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CARD HEADER / CONTENT / FOOTER
// ---------------------------------------------------------------------------

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-6 py-4 border-b border-silver-100", className)}>{children}</div>;
}

export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-6 py-4", className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-6 py-4 border-t border-silver-100 bg-silver-50", className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// SECTION HEADER — Premium typography with metallic accent line
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  desc?: string;
  dark?: boolean;
  className?: string;
  portal?: PortalTheme;
}

export function SectionHeader({ eyebrow, title, desc, dark = false, className, portal = "public" }: SectionHeaderProps) {
  const theme = designSystem.colors.portal[portal];
  const accentColor = portal === "student" ? theme.accent : portal === "faculty" ? theme.accent : "#1aa6b5";

  return (
    <div className={cn("animate-slide-up max-w-3xl", className)}>
      <p className={cn(
        "eyebrow-line text-[11px] font-bold tracking-[0.22em]",
        dark ? "text-teal-300" : `text-[${accentColor}]`
      )}>
        {eyebrow}
      </p>
      <h2 className={cn(
        "mt-3 text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-4xl lg:text-[40px]",
        dark ? "text-white" : `text-[${theme.text}]`
      )}>
        {title}
      </h2>
      <div className={`mt-4 w-20 h-1 bg-gradient-to-r from-[${accentColor}] to-transparent opacity-80`} aria-hidden />
      {desc && (
        <p className={cn(
          "mt-3 text-[15px] leading-relaxed",
          dark ? "text-silver-200" : "text-muted"
        )}>
          {desc}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PROGRESS BAR — Metallic tones
// ---------------------------------------------------------------------------

interface ProgressBarProps {
  value: number;
  tone?: "teal" | "navy" | "red" | "gold" | "accent";
  className?: string;
  showLabel?: boolean;
  label?: string;
}

export function ProgressBar({ value, tone = "teal", className, showLabel = false, label }: ProgressBarProps) {
  const colors = {
    teal: "bg-gradient-to-r from-teal-500 to-teal-400",
    navy: "bg-gradient-to-r from-slate-700 to-slate-600",
    red: "bg-gradient-to-r from-rose-500 to-rose-400",
    gold: "bg-gradient-to-r from-amber-500 to-yellow-400",
    accent: "bg-gradient-to-r from-amber-500 to-yellow-400",
  };

  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("relative h-2 w-full overflow-hidden rounded-full bg-silver-200 dark:bg-slate-700", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500 ease-out", colors[tone])}
        style={{ width: `${clampedValue}%` }}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      />
      {showLabel && (
        <span className="absolute right-0 top-[-20px] text-xs font-bold text-muted">
          {label ?? `${clampedValue}%`}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// INPUT / TEXTAREA / SELECT — Metallic variants
// ---------------------------------------------------------------------------

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant;
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  portal?: PortalTheme;
}

export function Input({ variant = "default", label, error, hint, icon, portal = "public", className, id, ...props }: InputProps) {
  const theme = designSystem.colors.portal[portal];
  const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const variants: Record<InputVariant, string> = {
    default: `bg-white border-2 border-[${theme.border}] focus:border-[${theme.primary}] focus:ring-2 focus:ring-[${theme.primary}]/20`,
    filled: `bg-[${theme.surfaceAlt}] border-2 border-transparent focus:border-[${theme.primary}] focus:ring-2 focus:ring-[${theme.primary}]/20`,
    outlined: `bg-transparent border-2 border-[${theme.border}] focus:border-[${theme.primary}] focus:ring-2 focus:ring-[${theme.primary}]/20`,
    ghost: `bg-transparent border-2 border-transparent focus:border-[${theme.primary}] focus:bg-[${theme.primaryLight}]`,
  };

  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className={cn("mb-1.5 block text-sm font-bold", theme.text)}>
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={cn(
            "w-full px-4 py-3 text-sm font-medium placeholder:text-muted",
            theme.text,
            "rounded-xl transition-all duration-200",
            "focus:outline-none focus-visible:ring-2",
            `focus-visible:ring-[${theme.primary}]/20`,
            "disabled:opacity-50 disabled:cursor-not-allowed",
            icon && "pl-10",
            error && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20",
            variants[variant],
            className
          )}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={describedBy}
          {...props}
        />
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-rose-600" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-sm font-medium text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: InputVariant;
  label?: string;
  error?: string;
  hint?: string;
  portal?: PortalTheme;
}

export function Textarea({ variant = "default", label, error, hint, portal = "public", className, id, ...props }: TextareaProps) {
  const theme = designSystem.colors.portal[portal];
  const inputId = id || `textarea-${Math.random().toString(36).slice(2, 9)}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const variants: Record<InputVariant, string> = {
    default: `bg-white border-2 border-[${theme.border}] focus:border-[${theme.primary}] focus:ring-2 focus:ring-[${theme.primary}]/20`,
    filled: `bg-[${theme.surfaceAlt}] border-2 border-transparent focus:border-[${theme.primary}] focus:ring-2 focus:ring-[${theme.primary}]/20`,
    outlined: `bg-transparent border-2 border-[${theme.border}] focus:border-[${theme.primary}] focus:ring-2 focus:ring-[${theme.primary}]/20`,
    ghost: `bg-transparent border-2 border-transparent focus:border-[${theme.primary}] focus:bg-[${theme.primaryLight}]`,
  };

  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className={cn("mb-1.5 block text-sm font-bold", theme.text)}>
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={cn(
          "w-full px-4 py-3 text-sm font-medium placeholder:text-muted",
          theme.text,
          "rounded-xl resize-y min-h-[100px] transition-all duration-200",
          "focus:outline-none focus-visible:ring-2",
          `focus-visible:ring-[${theme.primary}]/20`,
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20",
          variants[variant],
          className
        )}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={describedBy}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-rose-600" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-sm font-medium text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  variant?: InputVariant;
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  portal?: PortalTheme;
}

export function Select({ variant = "default", label, error, hint, options, placeholder, portal = "public", className, id, ...props }: SelectProps) {
  const theme = designSystem.colors.portal[portal];
  const selectId = id || `select-${Math.random().toString(36).slice(2, 9)}`;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;

  const variants: Record<InputVariant, string> = {
    default: `bg-white border-2 border-[${theme.border}] focus:border-[${theme.primary}] focus:ring-2 focus:ring-[${theme.primary}]/20`,
    filled: `bg-[${theme.surfaceAlt}] border-2 border-transparent focus:border-[${theme.primary}] focus:ring-2 focus:ring-[${theme.primary}]/20`,
    outlined: `bg-transparent border-2 border-[${theme.border}] focus:border-[${theme.primary}] focus:ring-2 focus:ring-[${theme.primary}]/20`,
    ghost: `bg-transparent border-2 border-transparent focus:border-[${theme.primary}] focus:bg-[${theme.primaryLight}]`,
  };

  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className={cn("mb-1.5 block text-sm font-bold", theme.text)}>
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            "w-full px-4 py-3 pr-10 text-sm font-medium",
            theme.text,
            "rounded-xl appearance-none transition-all duration-200",
            "focus:outline-none focus-visible:ring-2",
            `focus-visible:ring-[${theme.primary}]/20`,
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20",
            variants[variant],
            className
          )}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={describedBy}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-rose-600" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-sm font-medium text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LABEL HELPER
// ---------------------------------------------------------------------------

export function Label({ children, className, htmlFor }: { children: React.ReactNode; className?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("block text-sm font-bold text-muted", className)}>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// DIVIDER
// ---------------------------------------------------------------------------

export function Divider({ className, orientation = "horizontal" }: { className?: string; orientation?: "horizontal" | "vertical" }) {
  return (
    <hr className={cn(
      "border-silver-200 dark:border-slate-700",
      orientation === "horizontal" ? "w-full" : "h-full",
      className
    )} aria-hidden="true" />
  );
}

// ---------------------------------------------------------------------------
// TOOLTIP
// ---------------------------------------------------------------------------

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

export function Tooltip({ content, children, position = "top", delay = 200 }: TooltipProps) {
  const [visible, setVisible] = React.useState(false);
  const [timeoutId, setTimeoutId] = React.useState<NodeJS.Timeout | null>(null);

  const show = () => {
    const id = setTimeout(() => setVisible(true), delay);
    setTimeoutId(id);
  };

  const hide = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setVisible(false);
  };

  const positions = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {React.isValidElement(children) ? (
        React.cloneElement(children as React.ReactElement<any>, {
          onMouseEnter: show,
          onMouseLeave: hide,
          onFocus: show,
          onBlur: hide,
        })
      ) : children}
      {visible && (
        <div
          className={cn(
            "fixed z-[1500] animate-fade-in px-3 py-2 text-xs font-medium text-white rounded-lg shadow-lg",
            "bg-slate-900",
            {
              top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
              bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
              left: "right-full top-1/2 -translate-y-1/2 mr-2",
              right: "left-full top-1/2 -translate-y-1/2 ml-2",
            }[position]
          )}
          role="tooltip"
        >
          {content}
          <div className="absolute w-0 h-0 border-4 border-transparent" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------

export * from "@/lib/design-system";