// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { BenchEditors } from "./harness/BenchEditors.ts";
import { OpenPlan } from "./harness/OpenPlan.ts";
import {
  DEFAULT_SETTLE_MS,
  OpenRun
} from "./harness/OpenRun.ts";
import { ResultsFile } from "./harness/ResultsFile.ts";

const { values: args } = parseArgs({
  options: {
    plan: { type: "string" },
    rounds: { type: "string", default: "5" },
    out: { type: "string", default: "perf-results/ab.json" }
  }
});

if (args.plan === undefined) {
  throw new Error("Missing --plan <file.json>");
}

const plan = OpenPlan.read(args.plan);
const editors = (
  await BenchEditors.read()
).select(plan.editors);
const results = new ResultsFile(args.out, args);

for (const { round, variant } of plan.schedule(Number(args.rounds))) {
  console.log(`round ${round} ${variant.label}`);
  const run = new OpenRun({
    label: variant.label,
    runs: 1,
    editors,
    modes: plan.modes,
    phases: plan.phases,
    storage: variant.storage,
    prewarm: variant.prewarm,
    headless: false,
    cpuThrottle: 1,
    settleMs: DEFAULT_SETTLE_MS,
    profileDir: null,
    base: variant.base
  });

  for await (const measurement of run.measure()) {
    results.add(measurement);
  }
}
