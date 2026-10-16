// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { BenchEditors } from "./harness/BenchEditors.ts";
import { splitList } from "./harness/flags.ts";
import {
  FOLLOW_UP_PHASE,
  OpenPlan
} from "./harness/OpenPlan.ts";
import {
  OPEN_RUN_OPTIONS,
  OpenRun
} from "./harness/OpenRun.ts";
import { ResultsFile } from "./harness/ResultsFile.ts";
import { STUDIO_URL } from "./harness/StudioPage.ts";

const { values: args } = parseArgs({
  options: {
    runs: { type: "string", default: "5" },
    modes: { type: "string", default: "online,offline" },
    editors: { type: "string", default: "voxel-map,voxel-model,pixel-art" },
    phases: { type: "string", default: FOLLOW_UP_PHASE.options.join(",") },
    out: { type: "string", default: "perf-results/open.json" },
    label: { type: "string", default: "baseline" },
    storage: { type: "string", default: "{}" },
    prewarm: { type: "boolean", default: false },
    base: { type: "string", default: STUDIO_URL },
    ...OPEN_RUN_OPTIONS
  }
});

const plan = OpenPlan.parse(
  {
    editors: splitList(args.editors),
    modes: splitList(args.modes),
    phases: splitList(args.phases),
    variants: [
      {
        label: args.label,
        storage: JSON.parse(args.storage),
        prewarm: args.prewarm,
        base: args.base
      }
    ]
  },
  "The command line"
);
const run = new OpenRun(
  plan,
  await BenchEditors.read(),
  OpenRun.settingsFrom(args)
);
const results = new ResultsFile(args.out, "open", args);
for await (const measurement of run.measure(Number(args.runs))) {
  results.add(measurement);
}
