"use client";

// C6 canonicalization — the localStorage TEST engine is removed. What stays:
// id/timestamp helpers, advertisement delegates (single source remains
// lib/mockStore.ts), and notification helpers (consumed by the notification
// services/pages, which are out of scope for the test migration).

import {
  createAd as mockCreateAd,
  deleteAd as mockDeleteAd,
  getAllAds,
  updateAd as mockUpdateAd,
} from "@/lib/mockStore";
import type { Advertisement } from "@/lib/types";
import type { TestNotification } from "@/lib/testTypes";

const K = {
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
