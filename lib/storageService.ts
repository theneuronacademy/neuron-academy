// Phase 19 — Storage Service Abstraction
// Supports: Supabase, Local filesystem, S3-compatible
// Single interface for upload, signed URL generation, deletion

import { randomUUID } from "crypto";

export type StorageProvider = "supabase" | "local" | "s3";

export interface StorageConfig {
  provider: StorageProvider;
  // Supabase
  supabaseUrl?: string;
  supabaseKey?: string;
  supabaseBucket?: string;
  // Local
  localUploadDir?: string;
  localBaseUrl?: string;
  // S3
  s3Region?: string;
  s3Bucket?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3Endpoint?: string;
}

export interface UploadResult {
  ref: string; // durable reference (e.g., supabase://bucket/path, /uploads/path, s3://bucket/path)
  url: string; // public/signed URL for immediate use
  size: number;
  mimeType: string;
}

export interface SignedUrlOptions {
  expiresIn?: number; // seconds
  download?: boolean;
}

export class StorageService {
  private config: StorageConfig;
  private provider: StorageProvider;

  constructor(config: StorageConfig) {
    this.config = config;
    this.provider = config.provider;
  }

  static fromEnv(): StorageService {
    const provider = (process.env.STORAGE_PROVIDER as StorageProvider) || "local";
    return new StorageService({
      provider,
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      supabaseBucket: process.env.SUPABASE_BUCKET || "neuron-academy",
      localUploadDir: process.env.LOCAL_UPLOAD_DIR || "./public/uploads",
      localBaseUrl: process.env.LOCAL_BASE_URL || "/uploads",
      s3Region: process.env.S3_REGION,
      s3Bucket: process.env.S3_BUCKET,
      s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
      s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      s3Endpoint: process.env.S3_ENDPOINT,
    });
  }

  async upload(buffer: Buffer, path: string, mimeType: string): Promise<UploadResult> {
    switch (this.provider) {
      case "supabase":
        return this.uploadToSupabase(buffer, path, mimeType);
      case "local":
        return this.uploadToLocal(buffer, path, mimeType);
      case "s3":
        return this.uploadToS3(buffer, path, mimeType);
      default:
        throw new Error(`Unsupported storage provider: ${this.provider}`);
    }
  }

  async getSignedUrl(ref: string, options: SignedUrlOptions = {}): Promise<string> {
    const { expiresIn = 3600, download = false } = options;

    // Handle already-public URLs
    if (ref.startsWith("http://") || ref.startsWith("https://")) {
      return ref;
    }

    switch (this.provider) {
      case "supabase":
        return this.getSupabaseSignedUrl(ref, expiresIn, download);
      case "local":
        return this.getLocalUrl(ref);
      case "s3":
        return this.getS3SignedUrl(ref, expiresIn, download);
      default:
        throw new Error(`Unsupported storage provider: ${this.provider}`);
    }
  }

  async delete(ref: string): Promise<boolean> {
    switch (this.provider) {
      case "supabase":
        return this.deleteFromSupabase(ref);
      case "local":
        return this.deleteFromLocal(ref);
      case "s3":
        return this.deleteFromS3(ref);
      default:
        throw new Error(`Unsupported storage provider: ${this.provider}`);
    }
  }

  async list(prefix: string, limit = 100): Promise<Array<{ ref: string; size: number; lastModified: Date }>> {
    switch (this.provider) {
      case "supabase":
        return this.listSupabase(prefix, limit);
      case "local":
        return this.listLocal(prefix, limit);
      case "s3":
        return this.listS3(prefix, limit);
      default:
        throw new Error(`Unsupported storage provider: ${this.provider}`);
    }
  }

  // ===== Supabase Implementation =====
  private async uploadToSupabase(buffer: Buffer, path: string, mimeType: string): Promise<UploadResult> {
    const { supabaseUrl, supabaseKey, supabaseBucket } = this.config;
    if (!supabaseUrl || !supabaseKey || !supabaseBucket) {
      throw new Error("Supabase storage not configured");
    }

    const fullPath = `${path}`;
    const response = await fetch(`${supabaseUrl}/storage/v1/object/${supabaseBucket}/${fullPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": mimeType,
        "x-upsert": "true",
      },
      body: buffer,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase upload failed: ${error}`);
    }

    const ref = `supabase://${supabaseBucket}/${fullPath}`;
    const url = await this.getSupabaseSignedUrl(ref, 3600);
    return { ref, url, size: buffer.length, mimeType };
  }

  private async getSupabaseSignedUrl(ref: string, expiresIn: number, download: boolean): Promise<string> {
    const { supabaseUrl, supabaseKey, supabaseBucket } = this.config;
    if (!supabaseUrl || !supabaseKey || !supabaseBucket) {
      throw new Error("Supabase storage not configured");
    }

    // Extract path from ref: supabase://bucket/path
    const path = ref.replace(`supabase://${supabaseBucket}/`, "");

    const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/${supabaseBucket}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn, download }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase signed URL failed: ${error}`);
    }

    const data = await response.json();
    return `${supabaseUrl}/storage/v1${data.signedURL}`;
  }

  private async deleteFromSupabase(ref: string): Promise<boolean> {
    const { supabaseUrl, supabaseKey, supabaseBucket } = this.config;
    if (!supabaseUrl || !supabaseKey || !supabaseBucket) {
      throw new Error("Supabase storage not configured");
    }

    const path = ref.replace(`supabase://${supabaseBucket}/`, "");

    const response = await fetch(`${supabaseUrl}/storage/v1/object/${supabaseBucket}/${path}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${supabaseKey}` },
    });

    return response.ok;
  }

  private async listSupabase(prefix: string, limit: number): Promise<Array<{ ref: string; size: number; lastModified: Date }>> {
    const { supabaseUrl, supabaseKey, supabaseBucket } = this.config;
    if (!supabaseUrl || !supabaseKey || !supabaseBucket) {
      throw new Error("Supabase storage not configured");
    }

    const response = await fetch(`${supabaseUrl}/storage/v1/object/list/${supabaseBucket}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefix, limit }),
    });

    if (!response.ok) {
      throw new Error("Supabase list failed");
    }

    const data = await response.json();
    return data.map((item: any) => ({
      ref: `supabase://${supabaseBucket}/${item.name}`,
      size: item.metadata?.size || 0,
      lastModified: new Date(item.updated_at || item.created_at),
    }));
  }

  // ===== Local Implementation =====
  private async uploadToLocal(buffer: Buffer, path: string, mimeType: string): Promise<UploadResult> {
    const fs = await import("fs/promises");
    const pathModule = await import("path");
    const { localUploadDir, localBaseUrl } = this.config;

    if (!localUploadDir || !localBaseUrl) {
      throw new Error("Local storage not configured");
    }

    const fullPath = pathModule.join(localUploadDir, path);
    const dir = pathModule.dirname(fullPath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, buffer);

    const ref = `local://${path}`;
    const url = `${localBaseUrl}/${path}`;
    return { ref, url, size: buffer.length, mimeType };
  }

  private getLocalUrl(ref: string): string {
    const { localBaseUrl } = this.config;
    if (!localBaseUrl) throw new Error("Local storage not configured");
    const path = ref.replace("local://", "");
    return `${localBaseUrl}/${path}`;
  }

  private async deleteFromLocal(ref: string): Promise<boolean> {
    const fs = await import("fs/promises");
    const pathModule = await import("path");
    const { localUploadDir } = this.config;

    if (!localUploadDir) throw new Error("Local storage not configured");

    const path = ref.replace("local://", "");
    const fullPath = pathModule.join(localUploadDir, path);

    try {
      await fs.unlink(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  private async listLocal(prefix: string, limit: number): Promise<Array<{ ref: string; size: number; lastModified: Date }>> {
    const fs = await import("fs/promises");
    const pathModule = await import("path");
    const { localUploadDir } = this.config;

    if (!localUploadDir) throw new Error("Local storage not configured");

    const fullPrefix = pathModule.join(localUploadDir, prefix);
    const results: Array<{ ref: string; size: number; lastModified: Date }> = [];

    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= limit) break;
        const fullPath = pathModule.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          const stat = await fs.stat(fullPath);
          const relativePath = pathModule.relative(localUploadDir, fullPath);
          results.push({
            ref: `local://${relativePath}`,
            size: stat.size,
            lastModified: stat.mtime,
          });
        }
      }
    }

    try {
      await walk(fullPrefix);
    } catch {
      // Directory doesn't exist
    }

    return results.slice(0, limit);
  }

  // ===== S3 Implementation =====
  private async uploadToS3(buffer: Buffer, path: string, mimeType: string): Promise<UploadResult> {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { s3Region, s3Bucket, s3AccessKeyId, s3SecretAccessKey, s3Endpoint } = this.config;

    if (!s3Region || !s3Bucket || !s3AccessKeyId || !s3SecretAccessKey) {
      throw new Error("S3 storage not configured");
    }

    const client = new S3Client({
      region: s3Region,
      endpoint: s3Endpoint,
      credentials: { accessKeyId: s3AccessKeyId, secretAccessKey: s3SecretAccessKey },
    });

    await client.send(new PutObjectCommand({
      Bucket: s3Bucket,
      Key: path,
      Body: buffer,
      ContentType: mimeType,
    }));

    const ref = `s3://${s3Bucket}/${path}`;
    const url = await this.getS3SignedUrl(ref, 3600);
    return { ref, url, size: buffer.length, mimeType };
  }

  private async getS3SignedUrl(ref: string, expiresIn: number, download: boolean): Promise<string> {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const { s3Region, s3Bucket, s3AccessKeyId, s3SecretAccessKey, s3Endpoint } = this.config;

    if (!s3Region || !s3Bucket || !s3AccessKeyId || !s3SecretAccessKey) {
      throw new Error("S3 storage not configured");
    }

    const path = ref.replace(`s3://${s3Bucket}/`, "");
    const client = new S3Client({
      region: s3Region,
      endpoint: s3Endpoint,
      credentials: { accessKeyId: s3AccessKeyId, secretAccessKey: s3SecretAccessKey },
    });

    const command = new GetObjectCommand({
      Bucket: s3Bucket,
      Key: path,
      ResponseContentDisposition: download ? `attachment; filename="${path.split("/").pop()}"` : undefined,
    });

    return getSignedUrl(client, command, { expiresIn });
  }

  private async deleteFromS3(ref: string): Promise<boolean> {
    const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const { s3Region, s3Bucket, s3AccessKeyId, s3SecretAccessKey, s3Endpoint } = this.config;

    if (!s3Region || !s3Bucket || !s3AccessKeyId || !s3SecretAccessKey) {
      throw new Error("S3 storage not configured");
    }

    const path = ref.replace(`s3://${s3Bucket}/`, "");
    const client = new S3Client({
      region: s3Region,
      endpoint: s3Endpoint,
      credentials: { accessKeyId: s3AccessKeyId, secretAccessKey: s3SecretAccessKey },
    });

    try {
      await client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: path }));
      return true;
    } catch {
      return false;
    }
  }

  private async listS3(prefix: string, limit: number): Promise<Array<{ ref: string; size: number; lastModified: Date }>> {
    const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const { s3Region, s3Bucket, s3AccessKeyId, s3SecretAccessKey, s3Endpoint } = this.config;

    if (!s3Region || !s3Bucket || !s3AccessKeyId || !s3SecretAccessKey) {
      throw new Error("S3 storage not configured");
    }

    const client = new S3Client({
      region: s3Region,
      endpoint: s3Endpoint,
      credentials: { accessKeyId: s3AccessKeyId, secretAccessKey: s3SecretAccessKey },
    });

    const response = await client.send(new ListObjectsV2Command({
      Bucket: s3Bucket,
      Prefix: prefix,
      MaxKeys: limit,
    }));

    return (response.Contents || []).map((obj) => ({
      ref: `s3://${s3Bucket}/${obj.Key}`,
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
    }));
  }
}

// Singleton instance
let storageServiceInstance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = StorageService.fromEnv();
  }
  return storageServiceInstance;
}

export function setStorageService(service: StorageService) {
  storageServiceInstance = service;
}

// Helper functions for common operations
export async function uploadFile(buffer: Buffer, path: string, mimeType: string): Promise<UploadResult> {
  return getStorageService().upload(buffer, path, mimeType);
}

export async function getFileUrl(ref: string, options?: SignedUrlOptions): Promise<string> {
  return getStorageService().getSignedUrl(ref, options);
}

export async function deleteFile(ref: string): Promise<boolean> {
  return getStorageService().delete(ref);
}

export function generateStoragePath(category: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 100);
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
  return `${category}/${datePrefix}/${randomUUID()}-${safeName}`;
}