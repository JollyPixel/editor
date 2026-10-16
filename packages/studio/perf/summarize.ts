// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Internal Dependencies
import {
  MeasurementGroup,
  type MeasurementPick
} from "./analysis/MeasurementGroup.ts";
import { ResultsFile } from "./harness/ResultsFile.ts";

interface Column {
  title: string;
  cell(group: MeasurementGroup, control: MeasurementGroup | undefined): string | number;
}

// CONSTANTS
const kPhaseOrder = ["first", "cold", "reload", "reopen"];
const kColumns: Column[] = [
  { title: "editor", cell: (group) => group.editor },
  { title: "mode", cell: (group) => group.mode },
  { title: "phase", cell: (group) => group.phase },
  { title: "variant", cell: (group) => group.label },
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

const measurements = positionals.flatMap(ResultsFile.read);
const groups = MeasurementGroup.groupAll(measurements)
  .sort(compareGroups);
const columns = measurements.some((item) => item.memory !== undefined) ?
  [...kColumns, ...kMemoryColumns] :
  kColumns;

printTable(
  columns.map(({ title }) => title),
  groups.map((group) => columns.map(({ cell }) => cell(group, controlOf(group))))
);

if (args.steps) {
  const rows: (string | number)[][] = [];
  for (const group of groups) {
    if (args.phase !== undefined && args.phase !== group.phase) {
      continue;
    }
    const names = new Set(group.items.flatMap((item) => Object.keys(item.steps)));
    const steps = Array.from(names, (name) => {
      return {
        name,
        start: group.median((item) => item.steps[name]?.start),
        end: group.median((item) => item.steps[name]?.end)
      };
    }).sort((left, right) => left.end - right.end);
    for (const { name, start, end } of steps) {
      rows.push([group.editor, group.mode, group.phase, group.label, name, start, end]);
    }
  }
  console.log();
  printTable(["editor", "mode", "phase", "variant", "step", "start", "end"], rows);
}

function controlOf(
  group: MeasurementGroup
): MeasurementGroup | undefined {
  if (args.control === undefined || group.label === args.control) {
    return undefined;
  }

  return groups.find(
    (candidate) => candidate.label === args.control && candidate.sharesCellWith(group)
  );
}

function versus(
  group: MeasurementGroup,
  control: MeasurementGroup | undefined,
  pick: MeasurementPick
): string {
  const value = group.median(pick);
  if (control === undefined) {
    return String(value);
  }
  const difference = value - control.median(pick);

  return `${value} (${difference >= 0 ? "+" : ""}${difference})`;
}

function compareGroups(
  left: MeasurementGroup,
  right: MeasurementGroup
): number {
  const leftOrder = left.label === args.control ? 0 : 1;
  const rightOrder = right.label === args.control ? 0 : 1;

  return left.editor.localeCompare(right.editor) ||
    left.mode.localeCompare(right.mode) ||
    kPhaseOrder.indexOf(left.phase) - kPhaseOrder.indexOf(right.phase) ||
    leftOrder - rightOrder ||
    left.label.localeCompare(right.label);
}

function printTable(
  header: string[],
  rows: (string | number)[][]
): void {
  for (const cells of [header, header.map(() => "---"), ...rows]) {
    console.log(`| ${cells.join(" | ")} |`);
  }
}
