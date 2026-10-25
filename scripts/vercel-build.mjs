import { spawnSync } from "node:child_process";

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

runNpm(["run", "db:generate"]);
// PRISMA_MIGRATIONS.md documents this step, but the script never ran it:
// pending migrations must apply BEFORE the build ships so API code that
// selects newly added columns (e.g. ResultShowcase.description,
// Testimonial.achievement) can never serve against an unmigrated database.
// `prisma migrate deploy` is additive-only, skips already-applied migrations,
// and a failed apply fails this build — Vercel keeps serving the previous
// deployment. It never touches local/CI databases beyond the configured Vercel
// DATABASE_URL.
runNpm(["run", "db:deploy"]);
runNpm(["run", "build"]);
