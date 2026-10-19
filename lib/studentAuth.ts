"use client";

import React from "react";
import { DEMO_STUDENT } from "@/lib/seed";

export const STUDENT_AUTH_KEY = "neuron_student_session";

export interface StudentSession {
  studentId: string;
  name: string;
  loggedInAt: string;
}

export const DEMO_STUDENT_LOGIN = {
  email: "student@neuronacademy.in",
  studentId: DEMO_STUDENT.id,
  password: "student123",
  name: DEMO_STUDENT.name,
};

export function getStudentSession(): StudentSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STUDENT_AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StudentSession;
  } catch {
    return null;
  }
}

export function isStudentAuthenticated(): boolean {
  return getStudentSession() !== null;
}

export function studentLogin(identifier: string, password: string, nameHint = ""): StudentSession | null {
  const id = identifier.trim().toLowerCase();
  const ok =
    (id === DEMO_STUDENT_LOGIN.email || id === DEMO_STUDENT_LOGIN.studentId.toLowerCase() || id === "demo") &&
    password === DEMO_STUDENT_LOGIN.password;
  if (!ok) return null;
  const session: StudentSession = {
    studentId: DEMO_STUDENT_LOGIN.studentId,
    name: nameHint.trim() || DEMO_STUDENT_LOGIN.name,
    loggedInAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(STUDENT_AUTH_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
  return session;
}

export function studentLogout(): void {
  try {
    window.localStorage.removeItem(STUDENT_AUTH_KEY);
  } catch {
    /* ignore */
  }
}

export function useSession(): StudentSession | null {
  const [session, setSession] = React.useState<StudentSession | null>(null);

  React.useEffect(() => {
    setSession(getStudentSession());
    const handler = () => setSession(getStudentSession());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return session;
}
