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
runNpm(["run", "build"]);
