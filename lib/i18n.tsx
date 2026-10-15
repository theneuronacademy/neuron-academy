"use client";

// Minimal Hindi/English UI dictionary (beta: app chrome + key screens).
// Anything untranslated falls back to English — never blank, never broken.
// Stored in localStorage (pure UI preference, zero server authority).

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "en" | "hi";

const STRINGS = {
  en: {
    dashboard: "Dashboard",
    tests: "Tests",
    myBatch: "My Batch",
    books: "Books",
    notifications: "Notifications",
    profile: "Profile",
    batches: "My Batches",
    students: "Students",
    attendance: "Attendance",
    results: "Results",
    analytics: "Analytics",
    timetable: "Timetable",
    doubts: "Doubts",
    materials: "Study Material",
    revision: "Revision",
    report: "My Report",
    takeTest: "Take Test",
    markAttendance: "Mark Attendance",
    leaderboard: "Leaderboard",
    yourRank: "Your Rank",
    toppers: "Toppers",
    streakDays: "day streak",
    resume: "Resume",
    start: "Start",
    viewAll: "View all",
    loading: "Loading…",
  },
  hi: {
    dashboard: "डैशबोर्ड",
    tests: "टेस्ट",
    myBatch: "मेरा बैच",
    books: "किताबें",
    notifications: "सूचनाएं",
    profile: "प्रोफ़ाइल",
    batches: "मेरे बैच",
    students: "छात्र",
    attendance: "उपस्थिति",
    results: "परिणाम",
    analytics: "विश्लेषण",
    timetable: "समय-सारणी",
    doubts: "शंकाएं",
    materials: "अध्ययन सामग्री",
    revision: "दोहराव",
    report: "मेरी रिपोर्ट",
    takeTest: "टेस्ट दें",
    markAttendance: "उपस्थिति लगाएं",
    leaderboard: "लीडरबोर्ड",
    yourRank: "आपकी रैंक",
    toppers: "टॉपर्स",
    streakDays: "दिन की स्ट्रीक",
    resume: "जारी रखें",
    start: "शुरू करें",
    viewAll: "सभी देखें",
    loading: "लोड हो रहा है…",
  },
} as const;

export type UiKey = keyof (typeof STRINGS)["en"];

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: UiKey) => string }>({
  lang: "en",
  setLang: () => undefined,
  t: (k) => STRINGS.en[k],
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("neuron-lang");
      if (saved === "hi" || saved === "en") setLangState(saved);
    } catch {
      /* default */
    }
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem("neuron-lang", l);
    } catch {
      /* ignore */
    }
  }, []);
  const t = useCallback((k: UiKey) => STRINGS[lang][k] ?? STRINGS.en[k], [lang]);
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}

export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <button
      onClick={() => setLang(lang === "en" ? "hi" : "en")}
      aria-label="Switch language / भाषा बदलें"
      title="English / हिंदी"
      className={`rounded-lg border border-silver-300 px-2.5 py-1.5 text-[12px] font-extrabold text-navy-700 hover:border-teal-500 ${className}`}
    >
      {lang === "en" ? "हिं" : "EN"}
    </button>
  );
}
