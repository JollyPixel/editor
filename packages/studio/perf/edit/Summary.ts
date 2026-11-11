// Import Internal Dependencies
import { MarkdownTable } from "../report/MarkdownTable.ts";
import {
  MeasurementGroup,
  type MeasurementPick
} from "../report/MeasurementGroup.ts";
import type { EditMeasurement } from "./Sample.ts";
import { EDIT_SCENARIOS } from "./Scenario.ts";

type EditGroup = MeasurementGroup<EditMeasurement>;

interface Column {
  title: string;
  pick: MeasurementPick<EditMeasurement>;
  compared?: boolean;
}

// CONSTANTS
const kColumns: Column[] = [
  { title: "p50 ms", pick: (item) => item.latencyP50, compared: true },
  { title: "p95 ms", pick: (item) => item.latencyP95, compared: true },
  { title: "max ms", pick: (item) => item.latencyMax },
  { title: "inputs >50ms", pick: (item) => item.inputsOver50 },
  { title: "task ms/input", pick: (item) => item.taskMsPerInput, compared: true },
  { title: "script ms/input", pick: (item) => item.scriptMsPerInput },
  { title: "layout+style ms/input", pick: (item) => item.layoutMsPerInput + item.styleMsPerInput },
  { title: "long frames ms", pick: (item) => item.longFramesMs },
  { title: "sent KB", pick: (item) => item.socketSentKB }
];
const kMemoryColumns: Column[] = [
  { title: "MB", pick: (item) => item.memory?.allocatedMB },
  {
    title: "GC ms",
    pick: ({ memory }) => (memory === undefined ? undefined : memory.minorGc.ms + memory.majorGc.ms)
  }
];

export function editSummary(
  measurements: readonly EditMeasurement[],
  control?: string
): string {
  const columns = measurements.some((item) => item.memory !== undefined) ?
    [...kColumns, ...kMemoryColumns] :
    kColumns;
  const groups = MeasurementGroup.groupBy(
    measurements,
    (item) => [item.editor, item.scenario, item.mode, item.label]
  ).sort((left, right) => compare(left.sample, right.sample, control));

  const table = new MarkdownTable(
    ["editor", "KB", "scenario", "mode", "variant", "n", ...columns.map(({ title }) => title)],
    { fractionDigits: 1 }
  );
  for (const group of groups) {
    const { editor, scenario, mode, label } = group.sample;
    const controlGroup = control === undefined || label === control ?
      undefined :
      groups.find(({ sample }) => sample.label === control &&
        sample.editor === editor &&
        sample.scenario === scenario &&
        sample.mode === mode);
    table.add([
      editor,
      group.median((item) => item.textKB),
      scenario,
      mode,
      label,
      group.items.length,
      ...columns.map(({ pick, compared }) => group.versus(compared ? controlGroup : undefined, pick, 1))
    ]);
  }

  return [String(table), measureSummary(groups)].join("\n\n");
}

function measureSummary(
  groups: readonly EditGroup[]
): string {
  const table = new MarkdownTable(
    ["editor", "scenario", "mode", "variant", "measure", "count", "total ms", "max ms"],
    { fractionDigits: 1 }
  );
  for (const group of groups) {
    const { editor, scenario, mode, label } = group.sample;
    const names = new Set(group.items.flatMap((item) => Object.keys(item.measures)));
    for (const name of names) {
      table.add([
        editor,
        scenario,
        mode,
        label,
        name,
        group.median((item) => item.measures[name]?.count ?? 0),
        group.median((item) => item.measures[name]?.totalMs ?? 0),
        group.median((item) => item.measures[name]?.maxMs ?? 0)
      ]);
    }
  }

  return String(table);
}

function compare(
  left: EditMeasurement,
  right: EditMeasurement,
  control: string | undefined
): number {
  return left.editor.localeCompare(right.editor) ||
    EDIT_SCENARIOS.indexOf(left.scenario) - EDIT_SCENARIOS.indexOf(right.scenario) ||
    left.mode.localeCompare(right.mode) ||
    Number(right.label === control) - Number(left.label === control) ||
    left.label.localeCompare(right.label);
}
