"use client";

import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { directCloudinaryUpload } from "@/components/admin/directUpload";

interface CloudinaryUploadProps {
  category: string;
  accept: string;
  resourceType?: "image" | "video";
  onUploadComplete: (url: string, publicId: string) => void;
  disabled?: boolean;
  label?: string;
  buttonLabel?: string;
  /** Optional upload progress callback (0-100 percentage). */
  onProgress?: (pct: number) => void;
}

export function CloudinaryUpload({
  category,
  accept,
  resourceType = "image",
  onUploadComplete,
  disabled = false,
  label = "Upload",
  buttonLabel = "Choose file",
  onProgress,
}: CloudinaryUploadProps) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setError(null);
      setBusy(true);
      setProgress(0);

      try {
        // Signed DIRECT upload (secret stays server-side): first ask our API
        // for a signature, then POST straight to Cloudinary with XHR. This
        // bypasses the serverless proxy's request-body cap, so large-but-valid
        // files no longer borderline-fail with a generic server error.
        const setPct = (pct: number) => {
          setProgress(pct);
          if (onProgress) onProgress(pct);
        };
        const uploaded = await directCloudinaryUpload(file, category, resourceType, setPct);
        onUploadComplete(uploaded.url, uploaded.publicId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setBusy(false);
        setProgress(100);
      }
    },
    [category, resourceType, onUploadComplete, onProgress]
  );

  return (
    <div className="space-y-2">
      <label className="block text-[12px] font-bold text-navy-700">{label}</label>
      <div className="flex items-center gap-2">
        <label
          className="cursor-pointer rounded-xl border border-silver-300 px-4 py-2.5 text-[13px] font-bold text-navy-700 hover:border-teal-500 disabled:opacity-50 disabled:pointer-events-none"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {buttonLabel}
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
        {busy && (
          <span className="min-w-16 text-[11px] font-bold text-navy-600">{progress}%</span>
        )}
        {error && (
          <span className="text-[11px] font-bold text-crimson truncate">{error}</span>
        )}
      </div>
      {busy && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-silver-200">
          <div
            className="h-full rounded-full bg-teal-500 transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
