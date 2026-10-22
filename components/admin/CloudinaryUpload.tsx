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
        // Step 1: Get signed upload URL from server
        const fd = new FormData();
        fd.append("filename", file.name);
        fd.append("category", category);
        fd.append("resourceType", resourceType);
        fd.append("fileSize", String(file.size));

        let sigRes: Response;
        try {
          sigRes = await fetch("/api/admin/cloudinary/upload-signature", {
            method: "POST",
            body: fd,
          });
        } catch {
          setError("Cannot reach the server. Check your connection and try again.");
          return;
        }

        const sigJson = await sigRes.json().catch(() => null);
        if (!sigRes.ok || sigJson?.success !== true) {
          setError(sigJson?.error ?? "Could not get upload signature.");
          return;
        }

        const { uploadUrl, formFields } = sigJson.data;

        // Step 2: Upload file directly to Cloudinary
        const uploadFd = new FormData();
        uploadFd.append("file", file);
        Object.entries(formFields).forEach(([k, v]) => {
          uploadFd.append(k, String(v));
        });

        let upRes: Response;
        try {
          upRes = await fetch(uploadUrl, {
            method: "POST",
            body: uploadFd,
          });
        } catch {
          setError("Cannot reach Cloudinary upload server. Check your connection.");
          return;
        }

        if (!upRes.ok) {
          const errText = await upRes.text().catch(() => "");
          setError(`Cloudinary upload failed: ${errText}`);
          return;
        }

        const result = await upRes.json();
        if (result.secure_url) {
          onUploadComplete(result.secure_url, result.public_id);
        } else {
          setError("Unexpected Cloudinary response.");
        }
      } catch {
        setError("An unexpected error occurred during upload.");
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
