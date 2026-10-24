"use client";

// Shared signed-direct media upload helper (client).
// Replaces uploads through the server proxy (/api/admin/cloudinary/upload,
// bounded by the Vercel serverless request-body limit ~4.5 MB) with the same
// two-phase flow CloudinaryVideoUpload already uses for videos:
//   1) ask our API for a SIGNED direct-upload payload (secret stays server-side)
//   2) POST the file straight to Cloudinary with XHR (real progress)
// Cloudinary itself has no small body limit, so images near our own 5 MB cap
// no longer fail at the hosting-layer level — the intermittent "Server error"
// / "Upload failed." cases on About / Classroom / Gallery / Banner saves.

export interface DirectUploadResult {
  url: string;
  publicId: string;
}

/** Human message from a non-JSON / failed proxy response. */
function requestErrorMessage(res: { status: number } | null): string {
  if (!res) return "Upload could not start. Check your connection.";
  if (res.status === 413) return "The file is too large for this request. Use a smaller file.";
  if (res.status === 401 || res.status === 403) return "Your admin session has expired. Sign in again.";
  if (res.status === 503) return "Media storage is not configured on the server yet. Contact the academy's developer.";
  if (res.status >= 500) return "Server error while starting the upload. Please try again.";
  return "Upload could not start. Please try again.";
}

/** Cloudinary direct-upload error body: { error: { message } }. */
function cloudinaryErrorMessage(res: { status: number }, text: string): string {
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    if (parsed?.error?.message) return parsed.error.message;
  } catch {
    /* non-JSON body from the platform */
  }
  if (res.status === 401) return "Signature rejected by media storage. Please retry.";
  if (res.status === 413) return "The file is too large. Use a smaller file.";
  if (res.status >= 500) return "Media storage is unavailable. Please retry shortly.";
  return "Media storage rejected the upload. Please try again.";
}

/**
 * Upload ONE file straight to Cloudinary using a signed payload from our API.
 * Keeps the secret server-side; XHR gives real progress callbacks.
 */
export function directCloudinaryUpload(
  file: File,
  category: string,
  resourceType: "image" | "video",
  onProgress?: (pct: number) => void
): Promise<DirectUploadResult> {
  return (async () => {
    // Phase 1 — signed payload from our server (metadata-only validation).
    const fd = new FormData();
    fd.append("filename", file.name);
    fd.append("category", category);
    fd.append("resourceType", resourceType);
    fd.append("fileSize", String(file.size));
    const signRes = await fetch("/api/admin/cloudinary/upload-signature", {
      method: "POST",
      body: fd,
    });
    const signJson = (await signRes
      .json()
      .catch(() => null)) as {
      success?: boolean;
      error?: string;
      data?: { uploadUrl?: string; formFields?: Record<string, string> };
    } | null;
    if (!signRes.ok || !signJson || signJson.success !== true) {
      throw new Error(signJson?.error ?? requestErrorMessage(signRes.ok ? null : { status: signRes.status }));
    }
    const { uploadUrl, formFields } = signJson.data ?? {};
    if (!uploadUrl || !formFields) {
      throw new Error("Unexpected response from the server.");
    }

    // Phase 2 — direct upload to Cloudinary with progress reporting.
    const uploaded = await new Promise<DirectUploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadUrl);
      const body = new FormData();
      for (const [k, v] of Object.entries(formFields)) body.append(k, String(v));
      body.append("file", file);
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText) as {
            secure_url?: string;
            public_id?: string;
            error?: { message?: string };
          };
          if (xhr.status >= 200 && xhr.status < 300 && json.secure_url) {
            resolve({ url: json.secure_url, publicId: json.public_id ?? "" });
          } else {
            reject(new Error(cloudinaryErrorMessage({ status: xhr.status }, xhr.responseText)));
          }
        } catch {
          reject(new Error(cloudinaryErrorMessage({ status: xhr.status }, xhr.responseText)));
        }
      };
      xhr.onerror = () => reject(new Error("Cannot reach media storage. Check your connection."));
      xhr.send(body);
    });

    return uploaded;
  })();
}

