// Runtime/OCR deployment checks — static only (no OCR jobs, no network).
// Run: npm run runtime:check
// Asserts: explicit Node runtime where native APIs are used, conservative
// maxDuration values, the serverless OCR boundary (code OCR_NOT_AVAILABLE),
// unchanged import limits, ocrEnabled() gating, pinned engines, orphan
// traineddata removal, and no Edge runtime anywhere near Node APIs.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { needsOcr, ocrEnabled } from "../services/ocrService";

const ROOT = process.cwd();
const savedOcr = process.env.OCR_ENABLED;

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
function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (e === "route.ts") acc.push(p);
  }
  return acc;
}

async function main(): Promise<void> {
  // ------------------------------------------------- explicit runtime ---
  for (const rel of [
    "app/api/admin/books/upload/route.ts",
    "app/api/students/me/photo/route.ts",
    "app/api/tests/import/pdf/route.ts",
  ]) {
    check(rel + " declares nodejs runtime", read(rel).includes('export const runtime = "nodejs"'));
  }
  const allRoutes = walk(join(ROOT, "app", "api"));
  check(
    "no Edge runtime anywhere",
    allRoutes.every((f) => !readFileSync(f, "utf8").includes('runtime = "edge"'))
  );
  check("route count sane (>=70 handlers)", allRoutes.length >= 70);

  // ------------------------------------------------- maxDuration ---
  const expect: Array<[string, number]> = [
    ["app/api/auth/login/route.ts", 15],
    ["app/api/auth/admin/login/route.ts", 15],
    ["app/api/auth/student/login/route.ts", 15],
    ["app/api/auth/faculty/login/route.ts", 15],
    ["app/api/auth/student/register/route.ts", 15],
    ["app/api/auth/faculty/register/route.ts", 15],
    ["app/api/auth/otp/request/route.ts", 15],
    ["app/api/auth/otp/verify/route.ts", 15],
    ["app/api/tests/generate/route.ts", 30],
    ["app/api/tests/[id]/attempt/route.ts", 15],
    ["app/api/tests/[id]/submit/route.ts", 30],
    ["app/api/dashboard/stats/route.ts", 15],
    ["app/api/students/me/analytics/route.ts", 15],
    ["app/api/tests/import/pdf/route.ts", 60],
  ];
  for (const [rel, secs] of expect) {
    check(rel + " maxDuration " + secs, read(rel).includes("export const maxDuration = " + secs));
  }

  // ------------------------------------------------- OCR boundary ---
  const pdfRoute = read("app/api/tests/import/pdf/route.ts");
  check("OCR gate returns machine code", pdfRoute.includes('"OCR_NOT_AVAILABLE"'));
  check("OCR rejection is honest 422", pdfRoute.includes("status: 422"));
  check("OCR gate consults ocrEnabled", pdfRoute.includes("ocrEnabled()"));
  check("OCR rejection marks import FAILED", pdfRoute.includes('status: "FAILED"'));
  check("import keeps 10MB cap", pdfRoute.includes("10 * 1024 * 1024"));
  check("import keeps 50-page cap", pdfRoute.includes("MAX_PAGES = 50"));
  check("import keeps 10-OCR-page cap", pdfRoute.includes("MAX_OCR_PAGES = 10"));
  delete process.env.OCR_ENABLED;
  check("OCR disabled when unset", ocrEnabled() === false);
  process.env.OCR_ENABLED = "false";
  check("OCR disabled when false", ocrEnabled() === false);
  process.env.OCR_ENABLED = "true";
  check("OCR enabled when true", ocrEnabled() === true);
  process.env.OCR_ENABLED = "local";
  check("OCR enabled when local", ocrEnabled() === true);
  if (savedOcr === undefined) delete process.env.OCR_ENABLED;
  else process.env.OCR_ENABLED = savedOcr;
  check("thin text needs OCR", needsOcr("") === true && needsOcr("   ") === true);
  check(
    "real text skips OCR",
    needsOcr("What is 25% of 640? This stem carries enough extracted characters to pass the threshold.") === false
  );

  // ------------------------------------------------- native + engines ---
  check("orphan traineddata removed", !existsSync(join(ROOT, "eng.traineddata")));
  const pkg = JSON.parse(read("package.json")) as { engines?: { node?: string } };
  check("node engines pinned", typeof pkg.engines?.node === "string" && pkg.engines.node.includes("20"));
  const envExample = read(".env.example");
  check("OCR_ENABLED documented", envExample.includes("OCR_ENABLED"));
  check("NEXT_PUBLIC vars documented", envExample.includes("NEXT_PUBLIC_SITE_URL") && envExample.includes("NEXT_PUBLIC_WHATSAPP_URL"));

  console.log("runtime-check: " + pass + " passed, " + failed + " failed");
  if (failed > 0) process.exit(1);
}

void main();
