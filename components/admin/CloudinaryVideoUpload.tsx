"use client";

import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";

interface CloudinaryVideoUploadProps {
  category: string;
  accept?: string;
  onUploadComplete: (url: string, publicId: string) => void;
  disabled?: boolean;
  label?: string;
  buttonLabel?: string;
}

/**
 * Large-video uploader. Two phases:
 *  1) Ask our API for a SIGNED direct-upload payload (the Cloudinary secret
 *     never reaches the browser).
 *  2) POST the file straight to Cloudinary with XHR so we can report real
 *     upload progress — bypasses serverless request body-size limits, so the
 *     biggest allowed videos still upload reliably.
 */
export function CloudinaryVideoUpload({
  category,
  accept = "video/*",
  onUploadComplete,
  disabled = false,
  label = "Upload video",
  buttonLabel = "Choose video file",
}: CloudinaryVideoUploadProps) {
  const [stage, setStage] = useState<"idle" | "signing" | "uploading">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setError(null);
      setNotice(null);
      setProgress(0);
      setStage("signing");
      try {
        // Phase 1 — signed payload from our server.
        const fd = new FormData();
        fd.append("filename", file.name);
        fd.append("category", category);
        fd.append("fileSize", String(file.size));
        const signRes = await fetch("/api/admin/cloudinary/direct-upload-url", {
          method: "POST",
          body: fd,
        });
        const signJson = (await signRes.json().catch(() => null)) as {
          success?: boolean;
          error?: string;
          data?: { uploadUrl?: string; formFields?: Record<string, string> };
        } | null;
        if (!signRes.ok || !signJson || signJson.success !== true) {
          setError(signJson?.error ?? "Could not start the video upload.");
          setStage("idle");
          return;
        }
        const { uploadUrl, formFields } = signJson.data ?? {};
        if (!uploadUrl || !formFields) {
          setError("Unexpected response from the server.");
          setStage("idle");
          return;
        }

        // Phase 2 — direct upload to Cloudinary with progress reporting.
        setStage("uploading");
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", uploadUrl);
          const body = new FormData();
          for (const [k, v] of Object.entries(formFields)) body.append(k, String(v));
          body.append("file", file);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setProgress(pct);
              setNotice(pct < 100 ? `Uploading… ${pct}%` : "Finishing…");
            }
          };
          xhr.onload = () => {
            try {
              const json = JSON.parse(xhr.responseText) as {
                secure_url?: string;
                public_id?: string;
                error?: { message?: string };
              };
              if (xhr.status >= 200 && xhr.status < 300 && json.secure_url) {
                onUploadComplete(json.secure_url, json.public_id ?? "");
                resolve();
              } else {
                reject(new Error(json.error?.message ?? "Media storage rejected the video."));
              }
            } catch {
              reject(new Error("Unexpected response from media storage."));
            }
          };
          xhr.onerror = () => reject(new Error("Cannot reach media storage. Check your connection."));
          xhr.send(body);
        });
        setStage("idle");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Video upload failed.");
        setStage("idle");
      }
    },
    [category, onUploadComplete]
  );

  const busy = stage !== "idle";

  return (
    <div className="space-y-2">
      <label className="block text-[12px] font-bold text-navy-700">{label}</label>
      <div className="flex items-center gap-2">
        <label className="cursor-pointer rounded-xl border border-silver-300 px-4 py-2.5 text-[13px] font-bold text-navy-700 hover:border-teal-500 disabled:opacity-50 disabled:pointer-events-none">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {stage === "signing" ? "Preparing…" : buttonLabel}
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={disabled || busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFileSelect(f);
              e.target.value = "";
            }}
          />
        </label>
        {stage === "uploading" && (
          <span className="min-w-16 text-[11px] font-bold text-navy-600">{progress}%</span>
        )}
        {error && <span className="text-[11px] font-bold text-crimson">{error}</span>}
      </div>
      {stage === "uploading" && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-silver-200">
          <div
            className="h-full rounded-full bg-teal-500 transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {notice && !error && <span className="text-[11px] font-bold text-navy-600">{notice}</span>}
    </div>
  );
}
