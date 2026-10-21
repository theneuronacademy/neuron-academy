import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Pool } from "pg";

const BASELINE_MIGRATION = "20261021120000_current_schema_baseline";
const baselineSql = readFileSync(
  new URL(`../prisma/migrations/${BASELINE_MIGRATION}/migration.sql`, import.meta.url),
  "utf8",
);
const baselineEnumNames = [...baselineSql.matchAll(/^CREATE TYPE "([^"]+)" AS ENUM/gm)].map(
  ([, name]) => name,
);
const npmCli = process.env.npm_execpath;

function runNpm(args) {
  if (!npmCli) {
    throw new Error("Run this build script through npm so the package runner can be resolved safely.");
  }
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function verifyProductionDatabaseIsReady() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Production database setup stopped: DATABASE_URL is not configured.");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });

  try {
    const tableResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
         AND table_name <> '_prisma_migrations'`,
    );
    const existingTables = Number(tableResult.rows[0]?.count ?? 0);
    const existingEnumResult = await pool.query(
      `SELECT type_name
       FROM unnest($1::text[]) AS names(type_name)
       WHERE to_regtype(format('public.%I', type_name)) IS NOT NULL`,
      [baselineEnumNames],
    );
    const existingEnums = existingEnumResult.rows.map(({ type_name }) => type_name);
    const historyResult = await pool.query(
      `SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS present`,
    );
    const userResult = await pool.query(
      `SELECT to_regclass('public."User"') IS NOT NULL AS present`,
    );
    const userTablePresent = Boolean(userResult.rows[0]?.present);

    let baselineApplied = false;
    if (historyResult.rows[0]?.present) {
      const baselineResult = await pool.query(
        `SELECT EXISTS (
           SELECT 1 FROM public."_prisma_migrations" WHERE migration_name = $1
         ) AS applied`,
        [BASELINE_MIGRATION],
      );
      baselineApplied = Boolean(baselineResult.rows[0]?.applied);
    }

    if (existingTables > 0 && !baselineApplied) {
      throw new Error(
        "Production database setup stopped: existing public tables were found without the current baseline. No migration was run.",
      );
    }
    if (existingEnums.length > 0 && !baselineApplied) {
      throw new Error(
        "Production database setup stopped: existing enum types were found without the current baseline. No migration was run.",
      );
    }
    if (baselineApplied && !userTablePresent) {
      throw new Error(
        "Production database setup stopped: the current baseline is recorded, but public.User is missing. No migration was run.",
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Production database setup stopped:")) {
      throw error;
    }
    const code =
      error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? ` (${error.code})`
        : "";
    throw new Error(`Production database preflight failed${code}; migrations were not run.`);
  } finally {
    await pool.end();
  }
}

async function verifyProductionUserTableExists() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });
  try {
    const result = await pool.query(
      `SELECT to_regclass('public."User"') IS NOT NULL AS present`,
    );
    if (!result.rows[0]?.present) {
      throw new Error("Production database setup stopped: public.User is still missing after migration.");
    }
  } finally {
    await pool.end();
  }
}

if (process.env.VERCEL_ENV === "production") {
  await verifyProductionDatabaseIsReady();
  runNpm(["run", "db:deploy"]);
  await verifyProductionUserTableExists();
}

runNpm(["run", "db:generate"]);
runNpm(["run", "build"]);
