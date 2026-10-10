// Storage regression checks — no live Supabase credentials required.
// Run: npm run storage:check
// - Pure-function checks (validation, refs, traversal, config gating).
// - Local-provider integration (writes under public/uploads, then deletes;
//   that directory is gitignored and left clean).
// - Static assertions on route wiring (refs stored, cleanup before delete,
//   service key never in client code).
// Supabase network paths are fail-closed-tested against a discard address
// (127.0.0.1:9 refuses instantly) — no real bucket is ever touched.

import { existsSync } from "node:fs";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  COVER_URL_TTL_SEC,
  PRIVATE_URL_TTL_SEC,
  parseStorageRef,
  saveUpload,
  deleteStorageObject,
  resolveStorageUrl,
  storageProvider,
  validateCoverUpload,
  validatePdfUpload,
  validatePhotoUpload,
} from "../lib/storageProvider";

const ROOT = process.cwd();
const savedEnv = {
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  STORAGE_BUCKET: process.env.STORAGE_BUCKET,
};

let pass = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) pass += 1;
  else {
    failed += 1;
    console.error("FAIL: " + name);
  }
}
function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}
function restoreEnv(): void {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k as string];
    else process.env[k as string] = v;
  }
}

// Tiny valid PNG (1x1) + minimal PDF header for validator tests.
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082",
  "hex"
);
const PDF = Buffer.from("%PDF-1.7\n%reasonable\n1 0 obj\n<<>>\nendobj\n", "utf8");
const EXE = Buffer.from("TVqQAAMAAAAEAAAA", "base64");

// ------------------------------------------------------- validation ---
check("photo accepts valid png", validatePhotoUpload(PNG, "a.png") === null);
check("photo rejects exe bytes", validatePhotoUpload(EXE, "a.png") !== null);
check("photo rejects exe extension", validatePhotoUpload(PNG, "a.exe") !== null);
check("photo rejects empty", validatePhotoUpload(Buffer.alloc(0), "a.png") !== null);
check("photo rejects oversize", validatePhotoUpload(Buffer.alloc(2 * 1024 * 1024 + 1), "a.png") !== null);
check("cover accepts valid png", validateCoverUpload(PNG, "c.webp") === null);
check("cover rejects oversize", validateCoverUpload(Buffer.alloc(3 * 1024 * 1024 + 1), "c.png") !== null);
check("pdf accepts %PDF- magic", validatePdfUpload(PDF, "b.pdf") === null);
check("pdf rejects non-pdf bytes", validatePdfUpload(PNG, "b.pdf") !== null);
check("pdf rejects wrong extension", validatePdfUpload(PDF, "b.png") !== null);
check("pdf rejects empty", validatePdfUpload(Buffer.alloc(0), "b.pdf") !== null);

// ------------------------------------------------------- ref parsing ---
check("key-form parses", (() => {
  const p = parseStorageRef("supabase://neuron-uploads/photos/student-abc.jpg");
  return p !== null && p.bucket === "neuron-uploads" && p.key === "photos/student-abc.jpg" && p.scope === "photos";
})());
check("local path is not key-form", parseStorageRef("/uploads/photos/x.jpg") === null);
check("https url is not key-form", parseStorageRef("https://x/y.jpg") === null);
check("traversal rejected", parseStorageRef("supabase://b/../evil.jpg") === null);
check("backslash rejected", parseStorageRef("supabase://b/photos\\x.jpg") === null);
check("empty key rejected", parseStorageRef("supabase://b/") === null);
check("unknown scope rejected", parseStorageRef("supabase://b/other/x.jpg") === null);
check("book-pdfs scope accepted", parseStorageRef("supabase://b/book-pdfs/f.pdf")?.scope === "book-pdfs");

async function main(): Promise<void> {
// ------------------------------------------------------- config gating ---
delete process.env.STORAGE_PROVIDER;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_KEY;
delete process.env.STORAGE_BUCKET;
check("unset env defaults to local", storageProvider() === "local");
process.env.STORAGE_PROVIDER = "supabase";
check("supabase without keys stays local (fail-safe)", storageProvider() === "local");
process.env.SUPABASE_URL = "http://127.0.0.1:9";
process.env.SUPABASE_SERVICE_KEY = "discard-key";
process.env.STORAGE_BUCKET = "discard-bucket";
check("full config selects supabase", storageProvider() === "supabase");
const refused = await saveUpload("photos", PNG, "a.png");
check("supabase unreachable fails closed (no silent success)", refused.ok === false);
const refusedDel = await deleteStorageObject("supabase://discard-bucket/photos/x.jpg");
check("supabase delete unreachable returns false", refusedDel === false);
const refusedResolve = await resolveStorageUrl("supabase://discard-bucket/photos/x.jpg");
  check("unresolvable ref resolves to null", refusedResolve === null);
  restoreEnv();
  await productionFailClosed();

// ------------------------------------------------------- local integration ---
check("local mode active after restore", storageProvider() === "local");
const s1 = await saveUpload("photos", PNG, "../../evil.png");
check("local upload ok", s1.ok === true);
if (s1.ok) {
  check("generated path ignores client filename", !s1.ref.includes("evil") && s1.ref.startsWith("/uploads/photos/student-"));
  check("display url equals ref locally", s1.url === s1.ref);
  check(
    "file exists on disk",
    existsSync(join(ROOT, "public", decodeURIComponent(s1.ref).replace(/^\//, "").split("/").join("/")))
  );
  const s2 = await saveUpload("photos", PNG, "a.png");
  check("generated names unique", s2.ok === true && s2.ref !== s1.ref);
  const gone = await deleteStorageObject(s1.ref);
  check("local delete returns true", gone === true);
  check(
    "file removed from disk",
    !existsSync(join(ROOT, "public", decodeURIComponent(s1.ref).replace(/^\//, "").split("/").join("/")))
  );
  if (s2.ok === true) await deleteStorageObject(s2.ref);
}
const trav = await deleteStorageObject("../../../../etc/passwd");
check("traversal delete is safe no-op", trav === true);
const ext = await deleteStorageObject("https://example.com/x.jpg");
check("remote url delete is no-op true", ext === true);
const cov = await saveUpload("covers", PNG, "c.png");
if (cov.ok) {
  check("cover scope path", cov.ref.startsWith("/uploads/covers/cover-"));
  await deleteStorageObject(cov.ref);
}
check("cover TTL exceeds private TTL", COVER_URL_TTL_SEC > PRIVATE_URL_TTL_SEC);

// ------------------------------------------------------- static wiring ---
const photo = read("app/api/students/me/photo/route.ts");
check("photo stores durable ref", photo.includes("photoUrl: saved.ref"));
check("photo replaces via provider delete", photo.includes("deleteStorageObject(prev.photoUrl)"));
const profile = read("app/api/students/me/profile/route.ts");
check("profile translates refs at read", profile.includes("resolveStorageUrl(item.photoUrl)"));
check("profile rejects signed URLs", profile.includes("/object/sign/"));
const booksAdmin = read("app/api/admin/books/route.ts");
check("admin books list translates refs", booksAdmin.includes("resolveCoverUrl(b.coverImageUrl)"));
const booksPub = read("app/api/books/route.ts");
check("public books list translates refs", booksPub.includes("resolveCoverUrl(b.coverImageUrl)"));
const bookDel = read("app/api/admin/books/[id]/route.ts");
check(
  "book delete cleans storage before row delete",
  bookDel.includes("deleteStorageObject(ref)") && bookDel.indexOf("deleteStorageObject(ref)") < bookDel.indexOf("db.book.delete")
);
check("book delete fails closed on storage failure", bookDel.includes("Book was not deleted"));
const uploadPdf = read("app/api/admin/books/upload-pdf/route.ts");
check("book-pdf upload endpoint exists with validation", uploadPdf.includes("validatePdfUpload") && uploadPdf.includes('"book-pdfs"'));

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(e)) acc.push(p);
  }
  return acc;
}
const clientHits: string[] = [];
for (const dir of ["app", "components", "middleware.ts"]) {
  const base = join(ROOT, dir);
  const files = statSync(base).isDirectory() ? walk(base) : [base];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    if (src.includes("SUPABASE_SERVICE_KEY")) clientHits.push(f.slice(ROOT.length + 1));
  }
}
  check("service key never in client/app code", clientHits.length === 0);
  const providerSrc = read("lib/storageProvider.ts");
  check("provider never logs or returns the key", !providerSrc.includes("console.") && providerSrc.includes("Bearer ${env.key}"));
  check("production local uploads rejected before write", providerSrc.includes('STORAGE_NOT_CONFIGURED'));
  for (const rel of ["app/api/admin/books/upload/route.ts", "app/api/admin/books/upload-pdf/route.ts", "app/api/students/me/photo/route.ts"]) {
    check(`${rel} maps misconfig to 503`, read(rel).includes('saved.code === "STORAGE_NOT_CONFIGURED" ? 503 : 502'));
  }

  restoreEnv();
  console.log("storage-check: " + pass + " passed, " + failed + " failed");
  if (failed > 0) process.exit(1);
}

async function productionFailClosed(): Promise<void> {
// Production + local provider must reject BEFORE writing any file (serverless
// filesystems are ephemeral). Development keeps local uploads. Supabase paths
// are unaffected. NODE_ENV is saved and restored; no real bucket is touched.
  const savedNodeEnv = process.env.NODE_ENV;
  // NODE_ENV is typed read-only: mutate through a plain record view.
  const env = process.env as Record<string, string | undefined>;
  const listUploads = (): string[] => {
    const out: string[] = [];
    const walkDir = (dir: string): void => {
      let entries: string[] = [];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const e of entries) {
        const p = join(dir, e);
        try {
          if (statSync(p).isDirectory()) walkDir(p);
          else out.push(p);
        } catch {
          /* ignore races */
        }
      }
    };
    walkDir(join(ROOT, "public", "uploads"));
    return out;
  };
  delete process.env.STORAGE_PROVIDER;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_KEY;
  delete process.env.STORAGE_BUCKET;
  env.NODE_ENV = "production";
  check("production without storage config resolves local", storageProvider() === "local");
  const before = listUploads();
  for (const scope of ["photos", "covers", "book-pdfs"] as const) {
    const r = await saveUpload(scope, PNG, "a.png");
    check(`production+local ${scope} rejected with code`, r.ok === false && (r as { code?: string }).code === "STORAGE_NOT_CONFIGURED");
  }
  const after = listUploads();
  check("production rejection wrote no local file", after.length === before.length);
  delete env.NODE_ENV;
  const dev = await saveUpload("photos", PNG, "a.png");
  check("development+local preserves uploads", dev.ok === true);
  if (dev.ok === true) await deleteStorageObject(dev.ref);
  env.NODE_ENV = "production";
  process.env.STORAGE_PROVIDER = "supabase";
  process.env.SUPABASE_URL = "http://127.0.0.1:9";
  process.env.SUPABASE_SERVICE_KEY = "discard-key";
  process.env.STORAGE_BUCKET = "discard-bucket";
  const attempted = await saveUpload("photos", PNG, "a.png");
  check(
    "production+supabase still attempts provider path (no false misconfig)",
    attempted.ok === false && (attempted as { code?: string }).code !== "STORAGE_NOT_CONFIGURED"
  );
  if (savedNodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = savedNodeEnv;
  restoreEnv();
}

void main();
