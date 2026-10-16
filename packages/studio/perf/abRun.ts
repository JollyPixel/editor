// Import Node.js Dependencies
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

// CONSTANTS
const kHarness = path.join(import.meta.dirname, "openEditors.ts");

interface Variant {
  label: string;
  storage?: Record<string, string>;
  prewarm?: boolean;
  base?: string;
}

interface Plan {
  editors: string;
  modes: string;
  phases: string;
  variants: Variant[];
}

const { values: args } = parseArgs({
  options: {
    plan: { type: "string" },
    rounds: { type: "string", default: "5" },
    out: { type: "string", default: "perf-results/ab" }
  }
});

if (args.plan === undefined) {
  throw new Error("Missing --plan <file.json>");
}

const plan: Plan = JSON.parse(readFileSync(args.plan, "utf8"));
for (let round = 0; round < Number(args.rounds); round++) {
  const variants = round % 2 === 0 ? plan.variants : [...plan.variants].reverse();
  for (const variant of variants) {
    const harnessArgs = [
      kHarness,
      "--runs", "1",
      "--editors", plan.editors,
      "--modes", plan.modes,
      "--phases", plan.phases,
      "--label", variant.label,
      "--storage", JSON.stringify(variant.storage ?? {}),
      "--out", path.join(args.out, `${variant.label}-${round}.json`)
    ];
    if (variant.prewarm) {
      harnessArgs.push("--prewarm");
    }
    if (variant.base !== undefined) {
      harnessArgs.push("--base", variant.base);
    }
    console.log(`round ${round} ${variant.label}`);
    const result = spawnSync(process.execPath, harnessArgs, { stdio: "inherit" });
    if (result.status !== 0) {
      console.error(`round ${round} ${variant.label} exited with ${result.status}`);
    }
  }
}
