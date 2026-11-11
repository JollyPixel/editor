// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Internal Dependencies
import {
  STORAGE_FLAG,
  splitList
} from "../common/flags.ts";
import { ResultsFile } from "../report/ResultsFile.ts";
import { BenchEditors } from "../studio/BenchEditors.ts";
import { STUDIO_URL } from "../studio/StudioPage.ts";
import {
  EDIT_PLAN_SCHEMA,
  EDIT_TARGETS,
  readEditPlan
} from "./Plan.ts";
import { EditRun } from "./Run.ts";
import type { EditMeasurement } from "./Sample.ts";
import { EDIT_SCENARIOS } from "./Scenario.ts";
import { editSummary } from "./Summary.ts";

const { values: args } = parseArgs({
  options: {
    plan: { type: "string" },
    editors: { type: "string", default: EDIT_TARGETS.join(",") },
    modes: { type: "string", default: "offline" },
    scenarios: { type: "string", default: EDIT_SCENARIOS.join(",") },
    label: { type: "string", default: "baseline" },
    storage: { type: "string", default: "{}" },
    base: { type: "string", default: STUDIO_URL },
    keys: { type: "string", default: "60" },
    rounds: { type: "string", default: "3" },
    cpu: { type: "string", default: "1" },
    profile: { type: "string" },
    memory: { type: "string" },
    control: { type: "string" },
    out: { type: "string", default: "perf-results/edit.json" }
  }
});

const plan = args.plan === undefined ?
  EDIT_PLAN_SCHEMA.parse({
    editors: splitList(args.editors),
    modes: splitList(args.modes),
    scenarios: splitList(args.scenarios),
    variants: [
      {
        label: args.label,
        storage: STORAGE_FLAG.parse(args.storage),
        base: args.base
      }
    ]
  }) :
  readEditPlan(args.plan);

const run = new EditRun(plan, await BenchEditors.read(), {
  keys: Number(args.keys),
  cpuThrottle: Number(args.cpu),
  profileDir: args.profile ?? null,
  memoryDir: args.memory ?? null
});
const results = new ResultsFile<EditMeasurement>(args.out, "edit", args);
for await (const measurement of run.measure(Number(args.rounds))) {
  results.add(measurement);
}
console.log(`\n${editSummary([...results], args.control)}`);
