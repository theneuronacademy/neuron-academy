"use client";

// Centralized mock persistence for the Test Platform.
// Advertisements keep living in lib/mockStore.ts (do NOT fork them here —
// the ad helpers below delegate to it so public/admin ad surfaces never break).

import {
  createAd as mockCreateAd,
  deleteAd as mockDeleteAd,
  getAllAds,
  updateAd as mockUpdateAd,
} from "@/lib/mockStore";
import type { Advertisement } from "@/lib/types";
import type { BankQuestion, TestAttempt, TestItem, TestNotification, TestResult } from "@/lib/testTypes";

const K = {
  questions: "neuron_questions",
  tests: "neuron_tests",
  attempts: "neuron_attempts",
  results: "neuron_results",
  notifications: "neuron_notifications",
};

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("neuron-test-updated", { detail: { key } }));
  } catch {
    /* demo storage full — ignore */
  }
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

// ---------- Advertisements (delegated — single source stays lib/mockStore.ts) ----------
export function getAdvertisements(): Advertisement[] {
  return getAllAds();
}
export function saveAdvertisement(input: Omit<Advertisement, "id" | "createdAt" | "updatedAt">): Advertisement {
  return mockCreateAd(input);
}
export function updateAdvertisement(id: string, patch: Partial<Advertisement>): Advertisement | null {
  return mockUpdateAd(id, patch);
}
export function deleteAdvertisement(id: string): void {
  mockDeleteAd(id);
}

// ---------- Questions ----------
export function getQuestions(): BankQuestion[] {
  return read<BankQuestion>(K.questions).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function saveQuestion(q: BankQuestion): void {
  write(K.questions, [q, ...read<BankQuestion>(K.questions)]);
}
export function saveQuestions(qs: BankQuestion[]): void {
  write(K.questions, [...qs, ...read<BankQuestion>(K.questions)]);
}
export function updateQuestion(id: string, patch: Partial<BankQuestion>): BankQuestion | null {
  const all = read<BankQuestion>(K.questions);
  const i = all.findIndex((q) => q.id === id);
  if (i === -1) return null;
  const updated: BankQuestion = { ...all[i], ...patch, id, updatedAt: nowISO() };
  all[i] = updated;
  write(K.questions, all);
  return updated;
}
export function deleteQuestion(id: string): void {
  write(
    K.questions,
    read<BankQuestion>(K.questions).filter((q) => q.id !== id)
  );
}
export function getQuestionById(id: string): BankQuestion | null {
  return read<BankQuestion>(K.questions).find((q) => q.id === id) ?? null;
}

// ---------- Tests ----------
export function getTests(): TestItem[] {
  return read<TestItem>(K.tests).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function getTestById(id: string): TestItem | null {
  return read<TestItem>(K.tests).find((t) => t.id === id) ?? null;
}
export function saveTest(t: TestItem): void {
  write(K.tests, [t, ...read<TestItem>(K.tests)]);
}
export function updateTest(id: string, patch: Partial<TestItem>): TestItem | null {
  const all = read<TestItem>(K.tests);
  const i = all.findIndex((t) => t.id === id);
  if (i === -1) return null;
  const updated: TestItem = { ...all[i], ...patch, id, updatedAt: nowISO() };
  all[i] = updated;
  write(K.tests, all);
  return updated;
}
export function deleteTest(id: string): void {
  write(
    K.tests,
    read<TestItem>(K.tests).filter((t) => t.id !== id)
  );
}

// ---------- Attempts (localStorage per-test draft + final records) ----------
export function draftKey(testId: string, studentId: string): string {
  return `student_test_attempt_${testId}_${studentId}`;
}
export function getAttempts(): TestAttempt[] {
  return read<TestAttempt>(K.attempts).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}
export function getAttemptsByTest(testId: string): TestAttempt[] {
  return getAttempts().filter((a) => a.testId === testId);
}
export function saveAttempt(a: TestAttempt): void {
  const all = read<TestAttempt>(K.attempts).filter(
    (x) => !(x.testId === a.testId && x.studentId === a.studentId)
  );
  write(K.attempts, [a, ...all]);
}

// ---------- Results ----------
export function getResults(): TestResult[] {
  return read<TestResult>(K.results).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function getResultsByTest(testId: string): TestResult[] {
  return getResults().filter((r) => r.testId === testId);
}
export function getResultFor(testId: string, studentId: string): TestResult | null {
  return getResults().find((r) => r.testId === testId && r.studentId === studentId) ?? null;
}
export function saveResult(r: TestResult): void {
  const all = read<TestResult>(K.results).filter(
    (x) => !(x.testId === r.testId && x.studentId === r.studentId && !x.manual)
  );
  write(K.results, [r, ...all]);
}

// ---------- Notifications ----------
export function getNotifications(): TestNotification[] {
  return read<TestNotification>(K.notifications).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function saveNotification(n: TestNotification): void {
  write(K.notifications, [n, ...read<TestNotification>(K.notifications)]);
}
export function markNotificationRead(id: string): void {
  const all = read<TestNotification>(K.notifications);
  const i = all.findIndex((n) => n.id === id);
  if (i === -1) return;
  all[i] = { ...all[i], read: true };
  write(K.notifications, all);
}
