// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Internal Dependencies
import {
  BenchEditors,
  STUDIO_URL
} from "./harness/BenchEditors.ts";
import {
  MODES_SCHEMA,
  PHASES_SCHEMA,
  STORAGE_SCHEMA
} from "./harness/OpenPlan.ts";
import {
  DEFAULT_SETTLE_MS,
  FOLLOW_UP_PHASES,
  OpenRun
} from "./harness/OpenRun.ts";
import { ResultsFile } from "./harness/ResultsFile.ts";

const { values: args } = parseArgs({
  options: {
    runs: { type: "string", default: "5" },
    modes: { type: "string", default: "online,offline" },
    editors: { type: "string", default: "voxel-map,voxel-model,pixel-art" },
    phases: { type: "string", default: FOLLOW_UP_PHASES.join(",") },
    out: { type: "string", default: "perf-results/open.json" },
    label: { type: "string", default: "baseline" },
    storage: { type: "string", default: "{}" },
    prewarm: { type: "boolean", default: false },
    headless: { type: "boolean", default: false },
    cpu: { type: "string", default: "1" },
    settle: { type: "string", default: String(DEFAULT_SETTLE_MS) },
    profile: { type: "string" },
    base: { type: "string", default: STUDIO_URL }
  }
});

const editors = await BenchEditors.read();
const run = new OpenRun({
  label: args.label,
  runs: Number(args.runs),
  editors: editors.select(list(args.editors)),
  modes: MODES_SCHEMA.parse(list(args.modes)),
  phases: new Set(PHASES_SCHEMA.parse(list(args.phases))),
  storage: STORAGE_SCHEMA.parse(JSON.parse(args.storage)),
  prewarm: args.prewarm,
  headless: args.headless,
  cpuThrottle: Number(args.cpu),
  settleMs: Number(args.settle),
  profileDir: args.profile ?? null,
  base: args.base
});
const results = new ResultsFile(args.out, args);
for await (const measurement of run.measure()) {
  results.add(measurement);
}

function list(
  value: string
): string[] {
  return value.split(",").filter((item) => item !== "");
}
