// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { BenchEditors } from "../studio/BenchEditors.ts";
import { OpenPlan } from "./Plan.ts";
import {
  OPEN_RUN_OPTIONS,
  OpenRun
} from "./Run.ts";
import { ResultsFile } from "../report/ResultsFile.ts";
import type { OpenMeasurement } from "./Sample.ts";

const { values: args } = parseArgs({
  options: {
    plan: { type: "string" },
    rounds: { type: "string", default: "5" },
    out: { type: "string", default: "perf-results/ab.json" },
    ...OPEN_RUN_OPTIONS
  }
});

if (args.plan === undefined) {
  throw new Error("Missing --plan <file.json>");
}

const run = new OpenRun(
  OpenPlan.read(args.plan),
  await BenchEditors.read(),
  OpenRun.settingsFrom(args)
);
const results = new ResultsFile<OpenMeasurement>(args.out, "open", args);
for await (const measurement of run.measure(Number(args.rounds))) {
  results.add(measurement);
}
