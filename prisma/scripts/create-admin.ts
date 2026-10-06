// Phase 10 — one-time REAL admin provisioning (run locally, never in CI).
// Reads credentials ONLY from environment variables (never source code):
//   ADMIN_NAME, ADMIN_MOBILE, ADMIN_EMAIL, ADMIN_DOB (YYYY-MM-DD)
// Usage:
//   ADMIN_NAME="..." ADMIN_MOBILE="..." ADMIN_EMAIL="..." ADMIN_DOB="YYYY-MM-DD" npm run admin:create
// - mobile + DOB verified by re-reading the row (login-equivalent check)
// - refuses to run when an ADMIN with the same mobile/email already exists
// - prints NO credential values, only the admin id + email domain check
// - set a strong SESSION_SECRET in .env first (DOB hash is peppered with it)

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing ${name}. Pass it as an environment variable (never commit it).`);
    process.exit(1);
  }
  return v;
}

function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 && /^[6-9]\d{9}$/.test(d)) d = "91" + d;
  if (!/^\d{11,15}$/.test(d)) return null;
  return "+" + d;
}

function normalizeDob(input: string): string | null {
  const m = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (dt.getUTCFullYear() !== Number(m[1]) || dt.getUTCMonth() !== Number(m[2]) - 1 || dt.getUTCDate() !== Number(m[3])) return null;
  if (Number(m[1]) < 1900 || dt.getTime() > Date.now()) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set — aborting.");
    process.exit(1);
  }
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    console.error("SESSION_SECRET (min 16 chars) is required — aborting.");
    process.exit(1);
  }
  const name = required("ADMIN_NAME");
  const phone = normalizePhone(required("ADMIN_MOBILE"));
  const email = required("ADMIN_EMAIL").trim().toLowerCase();
  const dob = normalizeDob(required("ADMIN_DOB"));
  if (!phone) {
    console.error("Invalid ADMIN_MOBILE.");
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Invalid ADMIN_EMAIL.");
    process.exit(1);
  }
  if (!dob) {
    console.error("Invalid ADMIN_DOB (use YYYY-MM-DD).");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
  });
  try {
    const clash = await prisma.user.findFirst({ where: { OR: [{ phone, role: "ADMIN" }, { email }] }, select: { id: true } });
    if (clash) {
      console.error("An admin with this mobile/email already exists — aborting (no changes made).");
      process.exit(1);
    }
    const dobHash = await bcrypt.hash(`${secret}|${dob}`, 12);
    const unusable = await bcrypt.hash(`unusable|${Date.now()}:${Math.random()}`, 10);
    const admin = await prisma.user.create({
      data: { name, email, phone, passwordHash: unusable, dobHash, role: "ADMIN", isActive: true },
      select: { id: true },
    });
    // Verify the credential exactly as login would (read-back check).
    const check = await prisma.user.findFirst({ where: { phone, role: "ADMIN" }, select: { dobHash: true, isActive: true } });
    const verified = !!check?.dobHash && check.isActive && (await bcrypt.compare(`${secret}|${dob}`, check.dobHash as string));
    if (!verified) {
      await prisma.user.delete({ where: { id: admin.id } });
      console.error("Post-create verification failed — row rolled back. Aborting.");
      process.exit(1);
    }
    console.log("ADMIN-CREATED: id=" + admin.id + " (mobile+DOB login verified)");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("ADMIN-CREATE-FAILED");
  void e;
  process.exit(1);
});
