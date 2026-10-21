"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { type ButtonVariant, type ButtonSize, type CardVariant, type BadgeVariant, type InputSize } from "@/lib/design-system";

// ---------------------------------------------------------------------------
// BUTTON — Clean, accessible, with proper contrast
// ---------------------------------------------------------------------------

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconPosition = "left",
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const base = cn(
    "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-primary/30",
    "disabled:opacity-50 disabled:pointer-events-none",
    "rounded-xl"
  );

  const variants: Record<ButtonVariant, string> = {
    primary: "bg-brand-primary text-white hover:bg-brand-primary-hover shadow-primary active:bg-brand-primary/90",
    secondary: "bg-brand-secondary text-navy-950 hover:bg-brand-secondary-hover shadow-secondary active:bg-brand-secondary/90",
    metallic: "bg-gradient-to-r from-brand-secondary-300 to-brand-secondary text-navy-950 shadow-secondary hover:brightness-95",
    accent: "bg-brand-secondary text-navy-950 hover:bg-brand-secondary-hover shadow-secondary",
    outline: "border-2 border-brand-primary text-brand-primary hover:bg-brand-primary/5 active:bg-brand-primary/10",
    ghost: "text-brand-primary hover:bg-brand-primary/10 active:bg-brand-primary/20",
    destructive: "bg-semantic-error text-white hover:bg-semantic-error-dark active:bg-semantic-error/90 shadow-[0_4px_14px_-2px_rgb(239_68_68/0.4)]",
    link: "text-brand-primary hover:underline px-0 py-0",
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-sm gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2",
    xl: "px-8 py-4 text-lg gap-3",
  };

  const iconNode = icon ? (
    <span className="flex-shrink-0" aria-hidden="true">{icon}</span>
  ) : null;

  return (
    <button
      className={cn(base, variants[variant], sizes[size], loading && "cursor-wait", className)}
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
// STATUS BADGE — High contrast, accessible
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  variant?: BadgeVariant;
  tone?: "teal" | "navy" | "red" | "silver";
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export function StatusBadge({ variant, tone, children, className, dot = false }: StatusBadgeProps) {
  const toneVariants: Record<NonNullable<StatusBadgeProps["tone"]>, BadgeVariant> = {
    teal: "primary",
    navy: "default",
    red: "error",
    silver: "outline",
  };
  const resolvedVariant = variant ?? (tone ? toneVariants[tone] : "default");
  const variants: Record<BadgeVariant, string> = {
    default: "bg-neutral-100 text-neutral-700 border-neutral-200",
    primary: "bg-brand-primary/10 text-brand-primary-700 border-brand-primary/20",
    secondary: "bg-brand-secondary/15 text-brand-secondary-800 border-brand-secondary/30",
    success: "bg-semantic-success/10 text-semantic-success-dark border-semantic-success/20",
    warning: "bg-semantic-warning/10 text-semantic-warning-dark border-semantic-warning/20",
    error: "bg-semantic-error/10 text-semantic-error-dark border-semantic-error/20",
    outline: "bg-transparent text-neutral-700 border-neutral-300",
    teal: "bg-brand-primary/10 text-brand-primary-700 border-brand-primary/20",
    navy: "bg-navy-50 text-navy-900 border-navy-100",
    red: "bg-semantic-error/10 text-semantic-error-dark border-semantic-error/20",
    silver: "bg-silver-100 text-silver-700 border-silver-300",
  };

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wider",
      "animate-fade-in",
      variants[resolvedVariant],
      className
    )}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" aria-hidden="true" />}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// CARDS — Clean, elevated, with proper contrast
// ---------------------------------------------------------------------------

interface CardProps {
  variant?: CardVariant;
  className?: string;
  children: React.ReactNode;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ variant = "default", className, children, hover = false, onClick }: CardProps) {
  const variants = {
    default: "bg-white border border-neutral-200 shadow-sm",
    elevated: "bg-white border border-neutral-100 shadow-lg",
    outlined: "bg-transparent border-2 border-neutral-300",
    filled: "bg-neutral-50 border border-neutral-200",
    glass: "bg-white/80 backdrop-blur-md border border-white/20 shadow-lg",
    metallic: "bg-white border border-silver-200 shadow-card",
  };

  const hoverStyles = hover
    ? "hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
    : "";

  return (
    <div
      className={cn(
        "rounded-2xl overflow-hidden transition-all duration-300",
        variants[variant],
        hoverStyles,
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }} : undefined}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CARD SECTIONS
// ---------------------------------------------------------------------------

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-6 py-4 border-b border-neutral-200", className)}>{children}</div>;
}

export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-6 py-4", className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-6 py-4 border-t border-neutral-200 bg-neutral-50", className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// SECTION HEADER — Clean typography with brand accent
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  desc?: string;
  className?: string;
  dark?: boolean;
}

export function SectionHeader({ eyebrow, title, desc, className, dark = false }: SectionHeaderProps) {
  return (
    <div className={cn("animate-slide-up max-w-3xl", className)}>
      <p className={cn("text-xs font-bold tracking-[0.16em] uppercase", dark ? "text-brand-secondary-300" : "text-brand-primary")}>{eyebrow}</p>
      <h2 className={cn("mt-3 text-3xl font-extrabold leading-tight sm:text-4xl lg:text-[40px]", dark ? "text-white" : "text-navy-950")}>{title}</h2>
      <div className="mt-4 h-1 w-14 rounded-full bg-brand-secondary" aria-hidden />
      {desc && <p className={cn("mt-3 text-base leading-relaxed sm:text-lg", dark ? "text-silver-200" : "text-neutral-600")}>{desc}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PROGRESS BAR — Clean with brand colors
// ---------------------------------------------------------------------------

interface ProgressBarProps {
  value: number;
  className?: string;
  showLabel?: boolean;
  label?: string;
  tone?: "teal" | "navy" | "red";
}

export function ProgressBar({ value, className, showLabel = false, label, tone = "teal" }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const tones: Record<NonNullable<ProgressBarProps["tone"]>, string> = {
    teal: "bg-brand-primary",
    navy: "bg-navy-800",
    red: "bg-semantic-error",
  };
  return (
    <div className={cn("relative h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500 ease-out", tones[tone])}
        style={{ width: `${clampedValue}%` }}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      />
      {showLabel && (
        <span className="absolute right-0 top-[-20px] text-xs font-semibold text-neutral-500">
          {label ?? `${clampedValue}%`}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// INPUT / TEXTAREA / SELECT — Clean, accessible, high contrast
// ---------------------------------------------------------------------------

interface BaseInputProps {
  variant?: "default" | "filled" | "outlined" | "ghost";
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  size?: InputSize;
}

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">, BaseInputProps {}

export function Input({ variant = "default", label, error, hint, icon, size = "md", className, id, ...props }: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const variants = {
    default: "bg-white border-2 border-neutral-300 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20",
    filled: "bg-neutral-100 border-2 border-transparent focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20",
    outlined: "bg-transparent border-2 border-neutral-300 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20",
    ghost: "bg-transparent border-2 border-transparent focus:border-brand-primary focus:bg-brand-primary/5",
  };

  const sizes: Record<InputSize, string> = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-sm",
    lg: "px-5 py-4 text-base",
  };

  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-neutral-900">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-neutral-400">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={cn(
            "w-full text-sm font-medium text-neutral-900 placeholder:text-neutral-400",
            "rounded-xl transition-all duration-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            icon && "pl-10",
            error && "border-semantic-error focus:border-semantic-error focus:ring-semantic-error/20",
            variants[variant],
            sizes[size],
            className
          )}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={describedBy}
          {...props}
        />
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-semantic-error" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-sm font-medium text-neutral-500">
          {hint}
        </p>
      )}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, BaseInputProps {}

export function Textarea({ variant = "default", label, error, hint, size = "md", className, id, ...props }: TextareaProps) {
  const inputId = id || `textarea-${Math.random().toString(36).slice(2, 9)}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const variants = {
    default: "bg-white border-2 border-neutral-300 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20",
    filled: "bg-neutral-100 border-2 border-transparent focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20",
    outlined: "bg-transparent border-2 border-neutral-300 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20",
    ghost: "bg-transparent border-2 border-transparent focus:border-brand-primary focus:bg-brand-primary/5",
  };

  const sizes: Record<InputSize, string> = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-sm",
    lg: "px-5 py-4 text-base",
  };

  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-neutral-900">{label}</label>
      )}
      <textarea
        id={inputId}
        className={cn(
          "w-full text-sm font-medium text-neutral-900 placeholder:text-neutral-400",
          "rounded-xl resize-y min-h-[100px] transition-all duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-semantic-error focus:border-semantic-error focus:ring-semantic-error/20",
          variants[variant],
          sizes[size],
          className
        )}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={describedBy}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-semantic-error" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-sm font-medium text-neutral-500">
          {hint}
        </p>
      )}
    </div>
  );
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">, BaseInputProps {
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ variant = "default", label, error, hint, options, placeholder, size = "md", className, id, ...props }: SelectProps) {
  const selectId = id || `select-${Math.random().toString(36).slice(2, 9)}`;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;

  const variants = {
    default: "bg-white border-2 border-neutral-300 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20",
    filled: "bg-neutral-100 border-2 border-transparent focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20",
    outlined: "bg-transparent border-2 border-neutral-300 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20",
    ghost: "bg-transparent border-2 border-transparent focus:border-brand-primary focus:bg-brand-primary/5",
  };

  const sizes: Record<InputSize, string> = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-sm",
    lg: "px-5 py-4 text-base",
  };

  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-semibold text-neutral-900">{label}</label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            "w-full px-4 py-3 pr-10 text-sm font-medium text-neutral-900",
            "rounded-xl appearance-none transition-all duration-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-semantic-error focus:border-semantic-error focus:ring-semantic-error/20",
            variants[variant],
            sizes[size],
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
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-neutral-400">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-semantic-error" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-sm font-medium text-neutral-500">
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
    <label htmlFor={htmlFor} className={cn("block text-sm font-semibold text-neutral-700", className)}>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// DIVIDER
// ---------------------------------------------------------------------------

export function Divider({ className, orientation = "horizontal" }: { className?: string; orientation?: "horizontal" | "vertical" }) {
  return (
    <hr className={cn("border-neutral-200 dark:border-neutral-700", orientation === "horizontal" ? "w-full" : "h-full", className)} aria-hidden="true" />
  );
}

// ---------------------------------------------------------------------------
// TOOLTIP — Fixed implementation
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
            "bg-neutral-900",
            positions[position]
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
