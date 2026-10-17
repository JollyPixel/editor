// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { MarkdownTable } from "./analysis/MarkdownTable.ts";
import {
  MeasurementGroup,
  type MeasurementPick
} from "./analysis/MeasurementGroup.ts";
import {
  PHASES,
  type OpenMeasurement
} from "./harness/OpenSample.ts";
import { ResultsFile } from "./harness/ResultsFile.ts";

type OpenGroup = MeasurementGroup<OpenMeasurement>;
type OpenPick = MeasurementPick<OpenMeasurement>;

interface Column {
  title: string;
  cell(group: OpenGroup, control: OpenGroup | undefined): string | number;
}

// CONSTANTS
const kColumns: Column[] = [
  { title: "editor", cell: (group) => group.sample.editor },
  { title: "mode", cell: (group) => group.sample.mode },
  { title: "phase", cell: (group) => group.sample.phase },
  { title: "variant", cell: (group) => group.sample.label },
  { title: "n", cell: (group) => group.items.length },
  { title: "ready", cell: (group, control) => versus(group, control, (item) => item.clickToReady) },
  { title: "ready p90", cell: (group) => group.percentile((item) => item.clickToReady, 0.9) },
  { title: "settled", cell: (group, control) => versus(group, control, (item) => item.clickToSettled) },
  { title: "busy before ready", cell: (group) => group.median((item) => item.framesBeforeReady.total) },
  { title: "busy after ready", cell: (group) => group.median((item) => item.framesAfterReady.total) },
  { title: "longest frame after", cell: (group) => group.median((item) => item.framesAfterReady.longest) },
  { title: "transfer KB", cell: (group) => group.median((item) => item.transferKB) },
  { title: "requests", cell: (group) => group.median((item) => item.requests) },
  { title: "socket KB", cell: (group) => group.median((item) => item.socketKB) },
  { title: "script ms", cell: (group) => group.median((item) => item.cdp.scriptMs) }
];
const kMemoryColumns: Column[] = [
  { title: "allocated MB", cell: (group) => group.median((item) => item.memory?.allocatedMB) },
  {
    title: "GC ms",
    cell: (group) => group.median((item) => {
      const { memory } = item;

      return memory === undefined ? undefined : memory.minorGc.ms + memory.majorGc.ms;
    })
  },
  { title: "major GCs", cell: (group) => group.median((item) => item.memory?.majorGc.count) }
];

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    control: { type: "string" },
    steps: { type: "boolean", default: false },
    phase: { type: "string" }
  }
});

const measurements = positionals.flatMap((target) => ResultsFile.read(target, "open"));
const groups = MeasurementGroup.groupBy(
  measurements,
  (item) => [item.editor, item.mode, item.phase, item.label]
).sort(compareGroups);
const columns = measurements.some((item) => item.memory !== undefined) ?
  [...kColumns, ...kMemoryColumns] :
  kColumns;

const summary = new MarkdownTable(
  columns.map(({ title }) => title),
  { fractionDigits: 0 }
);
for (const group of groups) {
  summary.add(columns.map(({ cell }) => cell(group, findControlGroup(group))));
}
console.log(String(summary));

if (args.steps) {
  const steps = new MarkdownTable(
    ["editor", "mode", "phase", "variant", "step", "start", "end"],
    { fractionDigits: 0 }
  );
  for (const group of groups) {
    const { editor, mode, phase, label } = group.sample;
    if (args.phase !== undefined && args.phase !== phase) {
      continue;
    }
    const names = new Set(group.items.flatMap((item) => Object.keys(item.steps)));
    const medians = Array.from(names, (name) => {
      return {
        name,
        start: group.median((item) => item.steps[name]?.start),
        end: group.median((item) => item.steps[name]?.end)
      };
    }).sort((left, right) => left.end - right.end);
    for (const { name, start, end } of medians) {
      steps.add([editor, mode, phase, label, name, start, end]);
    }
  }
  console.log(`\n${steps}`);
}

function findControlGroup(
  group: OpenGroup
): OpenGroup | undefined {
  if (args.control === undefined || group.sample.label === args.control) {
    return undefined;
  }

  return groups.find(
    (candidate) => candidate.sample.label === args.control &&
      sharesCell(candidate.sample, group.sample)
  );
}

function sharesCell(
  left: OpenMeasurement,
  right: OpenMeasurement
): boolean {
  return left.editor === right.editor &&
    left.mode === right.mode &&
    left.phase === right.phase;
}

function versus(
  group: OpenGroup,
  control: OpenGroup | undefined,
  pick: OpenPick
): string {
  const value = Math.round(group.median(pick));
  if (control === undefined) {
    return String(value);
  }
  const difference = value - Math.round(control.median(pick));

  return `${value} (${difference >= 0 ? "+" : ""}${difference})`;
}

function compareGroups(
  { sample: left }: OpenGroup,
  { sample: right }: OpenGroup
): number {
  const leftOrder = left.label === args.control ? 0 : 1;
  const rightOrder = right.label === args.control ? 0 : 1;

  return left.editor.localeCompare(right.editor) ||
    left.mode.localeCompare(right.mode) ||
    PHASES.indexOf(left.phase) - PHASES.indexOf(right.phase) ||
    leftOrder - rightOrder ||
    left.label.localeCompare(right.label);
}
