"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface WidgetProps {
  identifier: string;
  onSuccess: (accessToken: string) => void;
  onError: (error: string) => void;
  onCancel?: () => void;
  className?: string;
}

type Msg91Callback = (response?: unknown) => void;
type Msg91Configuration = {
  widgetId: string;
  tokenAuth: string;
  identifier: string;
  exposeMethods: true;
  success: Msg91Callback;
  failure: Msg91Callback;
};

declare global {
  interface Window {
    initSendOTP?: (configuration: Msg91Configuration) => void | Promise<void>;
    sendOtp?: (identifier: string, success?: Msg91Callback, failure?: Msg91Callback) => void;
    verifyOtp?: (otp: string, success?: Msg91Callback, failure?: Msg91Callback, requestId?: string) => void;
    retryOtp?: (channel: string | null, success?: Msg91Callback, failure?: Msg91Callback, requestId?: string) => void;
  }
}

const WIDGET_ID = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID ?? "";
const WIDGET_TOKEN = process.env.NEXT_PUBLIC_MSG91_WIDGET_TOKEN ?? "";
const WIDGET_SCRIPT_ID = "msg91-otp-provider-script";
const WIDGET_SCRIPT_URL = "https://verify.msg91.com/otp-provider.js";

let widgetScriptPromise: Promise<void> | null = null;

function loadWidgetScript(): Promise<void> {
  if (typeof window.initSendOTP === "function") return Promise.resolve();
  if (widgetScriptPromise) return widgetScriptPromise;

  widgetScriptPromise = new Promise<void>((resolve, reject) => {
    let script = document.getElementById(WIDGET_SCRIPT_ID) as HTMLScriptElement | null;
    const created = !script;
    if (!script) {
      script = document.createElement("script");
      script.id = WIDGET_SCRIPT_ID;
      script.src = WIDGET_SCRIPT_URL;
      script.async = true;
    }

    const timeout = window.setTimeout(() => {
      widgetScriptPromise = null;
      reject(new Error("MSG91 verification could not be loaded. Please try again."));
    }, 12_000);
    const finish = () => {
      window.clearTimeout(timeout);
      if (typeof window.initSendOTP === "function") resolve();
      else {
        widgetScriptPromise = null;
        reject(new Error("MSG91 verification is unavailable. Please try again."));
      }
    };
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => {
      window.clearTimeout(timeout);
      widgetScriptPromise = null;
      reject(new Error("MSG91 verification could not be loaded. Check your connection and try again."));
    }, { once: true });
    if (created) document.head.appendChild(script);
  });

  return widgetScriptPromise;
}

function msg91Identifier(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `91${digits}` : null;
}

function extractAccessToken(value: unknown, depth = 0): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text.split(".").length === 3 && text.length > 30 ? text : null;
  }
  if (!value || typeof value !== "object" || depth > 3) return null;

  const record = value as Record<string, unknown>;
  const tokenKeys = ["accessToken", "access_token", "access-token", "token", "jwt"];
  for (const key of tokenKeys) {
    const token = extractAccessToken(record[key], depth + 1);
    if (token) return token;
  }
  for (const nested of Object.values(record)) {
    const token = extractAccessToken(nested, depth + 1);
    if (token) return token;
  }
  return null;
}

function extractRequestId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["reqId", "req_id", "requestId", "request_id"]) {
    if (typeof record[key] === "string" && record[key]) return record[key] as string;
  }
  return null;
}

function readableError(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string") {
    return value.message;
  }
  return "MSG91 could not verify this number. Check the OTP and try again.";
}

export function Msg91Widget({ identifier, onSuccess, onError, onCancel, className = "" }: WidgetProps) {
  const [ready, setReady] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const completedTokenRef = useRef<string | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const identifierForWidget = msg91Identifier(identifier);

  useEffect(() => { onSuccessRef.current = onSuccess; }, [onSuccess]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const finishVerification = useCallback((response: unknown) => {
    const token = extractAccessToken(response);
    if (!token) {
      setBusy(false);
      const message = "MSG91 did not return a verification token. Please try again.";
      setError(message);
      onErrorRef.current(message);
      return;
    }
    if (completedTokenRef.current === token) return;
    completedTokenRef.current = token;
    setBusy(false);
    onSuccessRef.current(token);
  }, []);

  const handleProviderFailure = useCallback((response: unknown) => {
    setBusy(false);
    const message = readableError(response);
    setError(message);
    onErrorRef.current(message);
  }, []);

  useEffect(() => {
    let active = true;
    setReady(false);
    if (!WIDGET_ID || !WIDGET_TOKEN || !identifierForWidget) return;

    loadWidgetScript()
      .then(async () => {
        if (!active || !window.initSendOTP) return;
        await window.initSendOTP({
          widgetId: WIDGET_ID,
          tokenAuth: WIDGET_TOKEN,
          identifier: identifierForWidget,
          exposeMethods: true,
          success: finishVerification,
          failure: handleProviderFailure,
        });

        let attempts = 0;
        const readyCheck = window.setInterval(() => {
          attempts += 1;
          if (!active) {
            window.clearInterval(readyCheck);
          } else if (window.sendOtp && window.verifyOtp) {
            window.clearInterval(readyCheck);
            setReady(true);
          } else if (attempts >= 80) {
            window.clearInterval(readyCheck);
            handleProviderFailure("MSG91 verification did not finish loading. Please try again.");
          }
        }, 100);
      })
      .catch((err: unknown) => {
        if (active) handleProviderFailure(err instanceof Error ? err.message : undefined);
      });

    return () => { active = false; };
  }, [identifierForWidget, finishVerification, handleProviderFailure]);

  function sendOtp() {
    setError(null);
    if (!ready || !identifierForWidget || !window.sendOtp) return;
    completedTokenRef.current = null;
    setBusy(true);
    window.sendOtp(
      identifierForWidget,
      (response) => {
        requestIdRef.current = extractRequestId(response);
        setOtpSent(true);
        setBusy(false);
      },
      handleProviderFailure,
    );
  }

  function verifyOtp() {
    setError(null);
    if (!window.verifyOtp || !otp.trim()) return;
    setBusy(true);
    window.verifyOtp(otp.trim(), finishVerification, handleProviderFailure, requestIdRef.current ?? undefined);
  }

  function resendOtp() {
    setError(null);
    if (!window.retryOtp) {
      sendOtp();
      return;
    }
    setBusy(true);
    window.retryOtp(
      null,
      () => setBusy(false),
      handleProviderFailure,
      requestIdRef.current ?? undefined,
    );
  }

  if (!WIDGET_ID || !WIDGET_TOKEN) {
    return (
      <div className={`${className} rounded-xl bg-crimson-50 px-4 py-3 text-sm font-semibold text-crimson`} role="alert">
        MSG91 OTP verification is not configured. Please contact the academy office.
      </div>
    );
  }

  if (!identifierForWidget) {
    return (
      <div className={`${className} rounded-xl bg-crimson-50 px-4 py-3 text-sm font-semibold text-crimson`} role="alert">
        Enter a valid 10-digit Indian mobile number to continue.
      </div>
    );
  }

  return (
    <div className={`${className} space-y-3`}>
      <p className="text-sm font-semibold text-slate-600">
        {otpSent ? `Enter the OTP sent to +${identifierForWidget}.` : `Verify +${identifierForWidget} with MSG91.`}
      </p>
      {error ? <p className="rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson" role="alert">{error}</p> : null}
      {otpSent ? (
        <>
          <label className="sr-only" htmlFor="msg91-otp-code">One-time password</label>
          <input
            id="msg91-otp-code"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter OTP"
            className="w-full rounded-xl border border-silver-300 px-4 py-3 text-center text-lg font-bold tracking-[0.35em] focus:border-navy-500 focus:outline-none"
          />
          <button type="button" onClick={verifyOtp} disabled={busy || !ready || otp.length < 4} className="w-full rounded-xl bg-navy-700 px-4 py-3 font-bold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? "Verifying…" : "Verify OTP"}
          </button>
          <button type="button" onClick={resendOtp} disabled={busy || !ready} className="w-full py-1 text-sm font-semibold text-navy-700 hover:underline disabled:opacity-50">
            Resend OTP
          </button>
        </>
      ) : (
        <button type="button" onClick={sendOtp} disabled={busy || !ready} className="w-full rounded-xl bg-navy-700 px-4 py-3 font-bold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? "Sending OTP…" : ready ? "Send OTP" : "Loading secure verification…"}
        </button>
      )}
      {onCancel ? <button type="button" onClick={onCancel} disabled={busy} className="w-full py-1 text-sm font-semibold text-slate-500 hover:underline disabled:opacity-50">← Change mobile number</button> : null}
    </div>
  );
}
