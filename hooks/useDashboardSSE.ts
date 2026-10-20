// Phase 19 — SSE Hook for Real-time Dashboard Updates

"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type DashboardEvent =
  | { type: "test-status-update"; tests: Array<{ id: string; title: string; status: string; startTime: string | null; endTime: string | null }> }
  | { type: "attendance-update"; records: Array<{ id: string; student: { name: string; studentId: string }; batch: { name: string }; status: string; createdAt: string }> }
  | { type: "notification-update"; notifications: Array<{ id: string; title: string; message: string; status: string; audience: string; priority: string; createdAt: string }> }
  | { type: "heartbeat"; timestamp: string }
  | { type: "connected"; timestamp: string };

export function useDashboardSSE(onEvent?: (event: DashboardEvent) => void) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<DashboardEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource("/api/sse/dashboard", { withCredentials: true });
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const dashboardEvent: DashboardEvent = { type: event.type as any, ...data };
        setLastEvent(dashboardEvent);
        onEvent?.(dashboardEvent);
      } catch {
        // Ignore parse errors
      }
    };

    es.addEventListener("test-status-update", (event) => {
      const data = JSON.parse(event.data);
      setLastEvent({ type: "test-status-update", ...data });
      onEvent?.({ type: "test-status-update", ...data });
    });

    es.addEventListener("attendance-update", (event) => {
      const data = JSON.parse(event.data);
      setLastEvent({ type: "attendance-update", ...data });
      onEvent?.({ type: "attendance-update", ...data });
    });

    es.addEventListener("notification-update", (event) => {
      const data = JSON.parse(event.data);
      setLastEvent({ type: "notification-update", ...data });
      onEvent?.({ type: "notification-update", ...data });
    });

    es.addEventListener("heartbeat", (event) => {
      const data = JSON.parse(event.data);
      setLastEvent({ type: "heartbeat", ...data });
    });

    es.addEventListener("connected", (event) => {
      const data = JSON.parse(event.data);
      setLastEvent({ type: "connected", ...data });
    });

    es.onerror = () => {
      setConnected(false);
      es.close();

      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      } else {
        setError("Connection lost. Please refresh the page.");
      }
    };
  }, [onEvent]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { connected, lastEvent, error, reconnect: connect };
}