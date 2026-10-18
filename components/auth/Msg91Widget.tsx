"use client";

import { useEffect, useRef, useState } from "react";

interface WidgetProps {
  onSuccess: (accessToken: string) => void;
  onError: (error: string) => void;
  onCancel?: () => void;
  className?: string;
}

const WIDGET_ID = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID ?? "";
const WIDGET_SCRIPT_URL = "https://control.msg91.com/api/v5/widget";

export function Msg91Widget({ onSuccess, onError, onCancel, className = "" }: WidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ close: () => void } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load the MSG91 widget script
    if (!document.getElementById("msg91-widget-script")) {
      const script = document.createElement("script");
      script.id = "msg91-widget-script";
      script.src = WIDGET_SCRIPT_URL;
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (!mounted || !WIDGET_ID || !containerRef.current) return;

    // Check if widget library is loaded
    const checkWidget = setInterval(() => {
      if ((window as unknown as { MSG91Widget?: unknown }).MSG91Widget && containerRef.current) {
        clearInterval(checkWidget);
try {
           widgetRef.current = (window as unknown as { MSG91Widget: (options: { widgetId: string; container: HTMLElement; onSuccess: (token: string) => void; onError: (error: string) => void; onClose: () => void }) => { close: () => void } }).MSG91Widget({
            widgetId: WIDGET_ID,
            container: containerRef.current,
            onSuccess: (token: string) => {
              onSuccess(token);
            },
            onError: (error: string) => {
              onError(error);
            },
            onClose: () => {
              if (onCancel) onCancel();
            },
          });
        } catch {
          onError("Failed to initialize verification widget.");
        }
      }
    }, 100);

    return () => {
      clearInterval(checkWidget);
      if (widgetRef.current) {
        try {
          widgetRef.current.close();
        } catch {
          /* ignore */
        }
        widgetRef.current = null;
      }
    };
  }, [mounted, onSuccess, onError, onCancel]);

  if (!mounted) {
    return <div className={className} />;
  }

  if (!WIDGET_ID) {
    return (
      <div className={`${className} rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson`} role="alert">
        MSG91 Widget is not configured. Please contact the academy office.
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
}