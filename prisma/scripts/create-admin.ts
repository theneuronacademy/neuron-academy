// One-time admin access repair. Creates the requested admin if absent, or
// resets only the existing ADMIN account for the target mobile number.
// Does not delete users or run migrations.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcryptjs";

const TARGET_PHONE = "+919711917317";
const TARGET_PHONE_DIGITS = "9711917317";
const TARGET_PHONE_E164_DIGITS = `91${TARGET_PHONE_DIGITS}`;

class UserFacingError extends Error {}

function safeCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function prompt(rl: readline.Interface, label: string): Promise<string> {
  return rl.question(`${label} `);
}

/** Read a password without echoing its characters to the terminal. */
function promptHidden(label: string): Promise<string> {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    return Promise.reject(new UserFacingError("Run this command in an interactive terminal so the password stays hidden."));
  }

  output.write(`${label} `);
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      input.off("data", onData);
      input.setRawMode(false);
      output.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") {
          finish(new UserFacingError("Admin provisioning cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = Array.from(value).slice(0, -1).join("");
          continue;
        }
        if (character >= " " && character !== "\u007f") value += character;
      }
    };
    input.on("data", onData);
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new UserFacingError("DATABASE_URL is not configured; no account changes were made.");
  }
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) {
    throw new UserFacingError("SESSION_SECRET must be configured before admin access can be enabled.");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    // Refuse to prompt for a password or write anything unless this is the
    // expected application database schema.
    const tableCheck = await prisma.$queryRaw<Array<{ user_table: string | null }>>`
      SELECT to_regclass('public."User"')::text AS user_table
    `;
    if (!tableCheck[0]?.user_table) {
      throw new UserFacingError('The configured database is reachable but public."User" is missing; no account changes were made.');
    }

    const rl = readline.createInterface({ input, output });
    let name: string;
    let email: string;
    try {
      name = (await prompt(rl, "Admin full name:")).trim();
      email = (await prompt(rl, "Admin email:")).trim().toLowerCase();
    } finally {
      rl.close();
    }

    if (!name || name.length > 120) {
      throw new UserFacingError("Enter a name between 1 and 120 characters; no account changes were made.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new UserFacingError("Enter a valid email address; no account changes were made.");
    }

    const password = await promptHidden("New admin password (8–128 characters; input hidden):");
    if (password.length < 8 || password.length > 128) {
      throw new UserFacingError("Use a password between 8 and 128 characters; no account changes were made.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const outcome = await prisma.$transaction(async (tx) => {
      const matching = await tx.$queryRaw<Array<{ id: string; role: string }>>`
        SELECT id, role::text AS role
        FROM public."User"
        WHERE regexp_replace(COALESCE(phone, ''), '[^[:digit:]]', '', 'g')
          IN (${TARGET_PHONE_DIGITS}, ${TARGET_PHONE_E164_DIGITS})
        FOR UPDATE
      `;
      if (matching.length > 1) {
        throw new UserFacingError("More than one account matches the target mobile; no account changes were made.");
      }
      const target = matching[0];
      if (target && target.role !== "ADMIN") {
        throw new UserFacingError("The target mobile belongs to a non-admin account; no account changes were made.");
      }

      const emailOwner = await tx.user.findUnique({ where: { email }, select: { id: true } });
      if (emailOwner && emailOwner.id !== target?.id) {
        throw new UserFacingError("That email is already attached to another account; no account changes were made.");
      }

      if (target) {
        await tx.user.update({
          where: { id: target.id },
          data: {
            name,
            email,
            phone: TARGET_PHONE,
            passwordHash,
            dobHash: null,
            isActive: true,
          },
        });
        return "updated" as const;
      }

      await tx.user.create({
        data: {
          name,
          email,
          phone: TARGET_PHONE,
          passwordHash,
          dobHash: null,
          role: "ADMIN",
          isActive: true,
        },
      });
      return "created" as const;
    });

    console.log(outcome === "created" ? "Admin account created." : "Existing target admin account updated.");
    console.log("Sign in at /admin/login using the target mobile and the password you entered.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof UserFacingError) {
    console.error(error.message);
  } else {
    const code = safeCode(error);
    console.error(`Admin provisioning failed${code ? ` (database code ${code})` : ""}; no credentials were printed.`);
  }
  process.exitCode = 1;
});
