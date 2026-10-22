"use client";

import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";

interface CloudinaryUploadProps {
  category: string;
  accept: string;
  resourceType?: "image" | "video";
  onUploadComplete: (url: string, publicId: string) => void;
  disabled?: boolean;
  label?: string;
  buttonLabel?: string;
}

export function CloudinaryUpload({
  category,
  accept,
  resourceType = "image",
  onUploadComplete,
  disabled = false,
  label = "Upload",
  buttonLabel = "Choose file",
}: CloudinaryUploadProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setError(null);
      setBusy(true);

      try {
        // Upload through our server proxy (avoids CORS issues with direct
        // Cloudinary browser uploads)
        const fd = new FormData();
        fd.append("filename", file.name);
        fd.append("category", category);
        fd.append("resourceType", resourceType);
        fd.append("file", file);

        const res = await fetch("/api/admin/cloudinary/upload", {
          method: "POST",
          body: fd,
        });

        const json = await res.json().catch(() => null);
        if (!res.ok || json?.success !== true) {
          setError(json?.error ?? "Cloudinary upload failed.");
          return;
        }

        const { url, publicId } = json.data;
        if (url) {
          onUploadComplete(url, publicId);
        } else {
          setError("Unexpected upload response.");
        }
      } catch {
        setError("Cannot reach the server. Check your connection.");
      } finally {
        setBusy(false);
      }
    },
    [category, resourceType, onUploadComplete]
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
        {error && (
          <span className="text-[11px] font-bold text-crimson truncate">{error}</span>
        )}
      </div>
    </div>
  );
}
