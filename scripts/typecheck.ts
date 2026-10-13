// Import Node.js Dependencies
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { text } from "node:stream/consumers";
import { fileURLToPath } from "node:url";

// Import Third-party Dependencies
import { Mutex } from "@openally/mutex";

// CONSTANTS
const kRootDir = path.join(import.meta.dirname, "..");
const kCheckConfig = path.join(kRootDir, "tsconfig", "check.json");
const kSkippedDirectories = new Set(["node_modules", "dist", "coverage", "public"]);
const kTsc = path.join(
  path.dirname(fileURLToPath(import.meta.resolve("typescript7/package.json"))),
  "bin",
  "tsc"
);

function extendsCheckConfig(
  configPath: string
): boolean {
  const { extends: parents = [] } = JSON.parse(fs.readFileSync(configPath, "utf8"));

  return [parents].flat().some((parent: string) => {
    if (!parent.startsWith(".")) {
      return false;
    }
    const parentPath = path.resolve(path.dirname(configPath), parent);

    return parentPath === kCheckConfig || extendsCheckConfig(parentPath);
  });
}

function checkConfigs(): string[] {
  return fs.globSync("**/tsconfig.json", {
    cwd: kRootDir,
    exclude: (entry) => {
      const name = path.basename(entry);

      return kSkippedDirectories.has(name) || name.startsWith(".");
    }
  })
    .map((config) => path.join(kRootDir, config))
    .filter(extendsCheckConfig);
}

async function typecheck(
  configPath: string,
  mutex: Mutex
): Promise<boolean> {
  using _ = await mutex.acquire();

  const child = spawn(
    process.execPath,
    [kTsc, "--noEmit", "--pretty", String(process.stdout.isTTY === true), "-p", configPath],
    { stdio: ["ignore", "pipe", "inherit"] }
  );
  const [output, [code]] = await Promise.all([
    text(child.stdout),
    once(child, "close")
  ]);
  if (code === 0) {
    return true;
  }

  console.error(`\n${path.relative(kRootDir, configPath)}\n${output}`);

  return false;
}

const mutex = new Mutex({
  concurrency: Math.max(1, Math.floor(os.availableParallelism() / 2))
});
const configs = checkConfigs();
const results = await Promise.all(
  configs.map((configPath) => typecheck(configPath, mutex))
);
const failures = results.filter((passed) => !passed).length;
if (failures > 0) {
  console.error(`${failures} of ${configs.length} projects failed to type-check`);
  process.exitCode = 1;
}
