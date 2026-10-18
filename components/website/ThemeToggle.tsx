"use client";

import { useTheme } from "@/components/website/ThemeProvider";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="relative inline-flex items-center gap-1 rounded-xl bg-silver-100 dark:bg-navy-800 p-1">
      {(["light", "dark", "system"] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTheme(t)}
          aria-pressed={theme === t}
          aria-label={t === "system" ? "System theme" : t === "dark" ? "Dark mode" : "Light mode"}
          className={cn(
            "relative flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all duration-200",
            theme === t
              ? "bg-teal-500 text-white shadow-card"
              : "text-muted hover:text-ink dark:hover:text-white"
          )}
        >
          {t === "light" && <Sun className="h-4 w-4" />}
          {t === "dark" && <Moon className="h-4 w-4" />}
          {t === "system" && <Monitor className="h-4 w-4" />}
          <span className="hidden sm:inline">{t.charAt(0).toUpperCase() + t.slice(1)}</span>
        </button>
      ))}
    </div>
  );
}

export function ThemeToggleCompact() {
  const { theme, setTheme } = useTheme();

  const icons = {
    light: <Sun className="h-5 w-5" />,
    dark: <Moon className="h-5 w-5" />,
    system: <Monitor className="h-5 w-5" />,
  };

  const labels = {
    light: "Switch to dark mode",
    dark: "Switch to light mode",
    system: "Use system preference",
  };

  const nextTheme = (() => {
    if (theme === "light") return "dark";
    if (theme === "dark") return "system";
    return "light";
  })();

  return (
    <button
      onClick={() => setTheme(nextTheme)}
      aria-label={labels[theme]}
      className="relative rounded-xl bg-silver-100 dark:bg-navy-800 p-2 text-muted hover:text-ink dark:hover:text-white transition-colors"
    >
      {icons[theme]}
      <span className="sr-only">{labels[theme]}</span>
    </button>
  );
}