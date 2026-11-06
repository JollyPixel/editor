// Import Node.js Dependencies
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Import Internal Dependencies
import { ROOT_DIR } from "../workspace/root.ts";

// CONSTANTS
const kTypeScriptFile = /\.(?:ts|tsx|mts|cts)$/;
const kReportedLines = 60;

interface StopHookInput {
  stop_hook_active?: boolean;
}

const input: StopHookInput = JSON.parse(readFileSync(0, "utf8") || "{}");
const changed = execFileSync("git", ["status", "--porcelain"], {
  cwd: ROOT_DIR,
  encoding: "utf8"
})
  .split("\n")
  .some((line) => kTypeScriptFile.test(line.trim()));

if (!input.stop_hook_active && changed) {
  const result = spawnSync("pnpm run typecheck", {
    cwd: ROOT_DIR,
    encoding: "utf8",
    shell: true
  });
  if (result.status !== 0) {
    const output = `${result.stdout}${result.stderr}`.trimEnd().split("\n");
    console.error([
      "pnpm run typecheck fails with TypeScript changes in the working tree:",
      ...output.slice(-kReportedLines)
    ].join("\n"));
    process.exitCode = 2;
  }
}
