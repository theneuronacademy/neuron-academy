// Phase 20 — Offline Test Hook
// Handles offline answer persistence and background sync

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  saveOfflineAnswers,
  getOfflineAnswers,
  getUnsyncedAnswers,
  markAnswersSynced,
  isOnline,
  onOnlineChange,
} from "@/lib/offlineTest";

interface OfflineAnswer {
  testId: string;
  attemptId: string;
  studentId: string;
  answers: Record<string, string | null>;
  marked: string[];
  currentQuestionIndex: number;
  timestamp: number;
  synced: boolean;
}

export function useOfflineTest(attemptId: string, studentId: string, testId: string) {
  const [saved, setSaved] = useState(false);
  const [synced, setSynced] = useState(false);
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<number>(0);

  // Track online status
  useEffect(() => {
    setOnline(isOnline());
    const cleanup = onOnlineChange(setOnline);
    return cleanup;
  }, []);

  // Load existing offline answers on mount
  useEffect(() => {
    loadOfflineAnswers();
  }, [attemptId]);

  // Periodic sync when online
  useEffect(() => {
    if (!online) return;
    syncIntervalRef.current = setInterval(() => {
      syncOfflineAnswers();
    }, 30000); // Every 30 seconds

    // Initial sync
    syncOfflineAnswers();

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [online, attemptId, studentId]);

  const loadOfflineAnswers = useCallback(async () => {
    try {
      const data = await getOfflineAnswers(attemptId);
      if (data) {
        setSynced(data.synced);
        setLastSaved(data.timestamp);
      }
    } catch {
      /* ignore */
    }
  }, [attemptId]);

  const saveAnswers = useCallback(async (data: {
    answers: Record<string, string | null>;
    marked: string[];
    currentQuestionIndex: number;
  }) => {
    try {
      await saveOfflineAnswers({
        testId,
        attemptId,
        studentId,
        ...data,
      });
      setSaved(true);
      setLastSaved(Date.now());
      setSynced(false);
      // Trigger immediate sync if online
      if (online) {
        syncOfflineAnswers();
      }
    } catch (err) {
      console.error("Failed to save offline answers:", err);
    }
  }, [attemptId, studentId, testId, online]);

  const syncOfflineAnswers = useCallback(async () => {
    if (!online || !navigator.onLine) return;
    if (Date.now() - lastSyncRef.current < 10000) return; // Throttle: max once per 10s

    try {
      const unsynced = await getUnsyncedAnswers(studentId);
      setPendingCount(unsynced.length);

      for (const data of unsynced) {
        try {
          // Send to server
          const res = await fetch(`/api/tests/${data.testId}/attempt`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attemptId: data.attemptId,
              answers: data.answers,
              baseUpdatedAt: new Date(data.timestamp).toISOString(),
            }),
          });
          if (res.ok) {
            await markAnswersSynced(data.attemptId);
            if (data.attemptId === attemptId) {
              setSynced(true);
            }
          }
        } catch {
          /* continue with next */
        }
      }
      setPendingCount(0);
      lastSyncRef.current = Date.now();
    } catch {
      /* ignore */
    }
  }, [attemptId, studentId, online]);

  return {
    saved,
    synced,
    online,
    pendingCount,
    lastSaved,
    saveAnswers,
    forceSync: syncOfflineAnswers,
  };
}