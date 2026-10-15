// Import Node.js Dependencies
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

// Import Internal Dependencies
import type { OpenMeasurement } from "./openEditors.ts";

// CONSTANTS
const kPhaseOrder = ["first", "cold", "reload", "reopen"];

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    control: { type: "string" },
    steps: { type: "boolean", default: false },
    phase: { type: "string" }
  }
});

const measurements = positionals.flatMap(readMeasurements);
const groups = groupBy(measurements, (item) => [item.editor, item.mode, item.phase, item.label].join("|"));
const keys = [...groups.keys()].sort(compareKeys);

console.log([
  "| editor | mode | phase | variant | n | ready | ready p90 | settled",
  "| busy before ready | busy after ready | longest frame after | transfer KB | requests | socket KB |"
].join(" "));
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const key of keys) {
  const list = groups.get(key)!;
  const [editor, mode, phase, label] = key.split("|");
  const control = args.control === undefined || args.control === label ?
    undefined :
    groups.get([editor, mode, phase, args.control].join("|"));
  console.log(
    `| ${editor} | ${mode} | ${phase} | ${label} | ${list.length}`,
    `| ${versus(list, control, (item) => item.clickToReady)}`,
    `| ${percentile(list.map((item) => item.clickToReady), 0.9)}`,
    `| ${versus(list, control, (item) => item.clickToSettled)}`,
    `| ${median(list.map((item) => item.framesBeforeReady.total))}`,
    `| ${median(list.map((item) => item.framesAfterReady.total))}`,
    `| ${median(list.map((item) => item.framesAfterReady.longest))}`,
    `| ${median(list.map((item) => item.transferKB))} | ${median(list.map((item) => item.requests))}`,
    `| ${median(list.map((item) => item.socketKB))} |`
  );
}

if (args.steps) {
  console.log("\n| editor | mode | phase | variant | step | start | end |");
  console.log("|---|---|---|---|---|---|---|");
  for (const key of keys) {
    const [editor, mode, phase, label] = key.split("|");
    if (args.phase !== undefined && args.phase !== phase) {
      continue;
    }
    const list = groups.get(key)!;
    const names = new Set(list.flatMap((item) => Object.keys(item.steps)));
    const rows = [...names].map((name) => {
      const values = list.flatMap((item) => (item.steps[name] ? [item.steps[name]] : []));

      return {
        name,
        start: median(values.map((value) => value.start)),
        end: median(values.map((value) => value.end))
      };
    }).sort((a, b) => a.end - b.end);
    for (const row of rows) {
      console.log(`| ${editor} | ${mode} | ${phase} | ${label} | ${row.name} | ${row.start} | ${row.end} |`);
    }
  }
}

function versus(
  list: OpenMeasurement[],
  control: OpenMeasurement[] | undefined,
  pick: (item: OpenMeasurement) => number
): string {
  const value = median(list.map(pick));
  if (control === undefined) {
    return String(value);
  }
  const difference = value - median(control.map(pick));

  return `${value} (${difference >= 0 ? "+" : ""}${difference})`;
}

function readMeasurements(
  target: string
): OpenMeasurement[] {
  if (statSync(target).isDirectory()) {
    return readdirSync(target)
      .filter((file) => file.endsWith(".json"))
      .flatMap((file) => readMeasurements(path.join(target, file)));
  }

  return JSON.parse(readFileSync(target, "utf8")).measurements;
}

function groupBy<T>(
  items: T[],
  keyOf: (item: T) => string
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...groups.get(key) ?? [], item]);
  }

  return groups;
}

function compareKeys(
  left: string,
  right: string
): number {
  const [leftEditor, leftMode, leftPhase, leftLabel] = left.split("|");
  const [rightEditor, rightMode, rightPhase, rightLabel] = right.split("|");
  const leftOrder = leftLabel === args.control ? 0 : 1;
  const rightOrder = rightLabel === args.control ? 0 : 1;

  return leftEditor.localeCompare(rightEditor) ||
    leftMode.localeCompare(rightMode) ||
    kPhaseOrder.indexOf(leftPhase) - kPhaseOrder.indexOf(rightPhase) ||
    leftOrder - rightOrder ||
    leftLabel.localeCompare(rightLabel);
}

function median(
  values: number[]
): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;

  return Math.round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

function percentile(
  values: number[],
  rank: number
): number {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * rank) - 1)];
}
