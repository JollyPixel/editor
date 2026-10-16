// Import Node.js Dependencies
import path from "node:path";
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { MarkdownTable } from "./analysis/MarkdownTable.ts";
import {
  MeasurementGroup,
  type MeasurementPick
} from "./analysis/MeasurementGroup.ts";
import type { GcPauses } from "./analysis/Trace.ts";
import { alternatingRounds } from "./harness/alternatingRounds.ts";
import { BenchBrowser } from "./harness/BenchBrowser.ts";
import {
  BenchEditors,
  type BenchEditor
} from "./harness/BenchEditors.ts";
import {
  EditorViewport,
  VIEWPORT_SCENARIOS
} from "./harness/EditorViewport.ts";
import {
  DEFAULT_SETTLE_MS,
  MODE_FLAG,
  STORAGE_FLAG,
  splitList
} from "./harness/flags.ts";
import {
  FRAME_PACING_THRESHOLDS,
  startFramePacing,
  stopFramePacing
} from "./harness/framePacing.ts";
import { readProbe } from "./harness/openProbe.ts";
import { ResultsFile } from "./harness/ResultsFile.ts";
import { STUDIO_URL } from "./harness/StudioPage.ts";
import { StudioSession } from "./harness/StudioSession.ts";
import {
  SteadySample,
  type SteadyMeasurement
} from "./harness/SteadySample.ts";

// CONSTANTS
const kBetweenScenariosMs = 500;
const kSummaryColumns: [string, MeasurementPick<SteadyMeasurement>][] = [
  ["main thread ms/s", (item) => item.taskMsPerSecond],
  ["script ms/s", (item) => item.scriptMsPerSecond],
  ["MB/s", (item) => item.allocatedMBPerSecond],
  ["KB/frame", (item) => item.allocatedKBPerFrame],
  ["minor GC/s", (item) => perSecond(item, item.minorGc.count)],
  ["GC ms/s", (item) => perSecond(item, item.minorGc.ms + item.majorGc.ms)],
  ["major GCs", (item) => item.majorGc.count],
  ["frames/s", (item) => perSecond(item, item.frames)],
  ["renders/s", (item) => perSecond(item, item.renders)],
  ["wakes", (item) => item.wakes],
  ["idle %", (item) => (item.idleMs * 100) / item.elapsedMs],
  ["worst frame ms", (item) => item.worstFrameMs],
  ["long frames ms", (item) => item.longFramesMs],
  ["heap growth MB", (item) => item.heapGrowthMB]
];

const { values: args } = parseArgs({
  options: {
    editors: { type: "string", default: "voxel-map,voxel-model,pixel-art" },
    mode: { type: "string", default: "offline" },
    scenarios: { type: "string", default: VIEWPORT_SCENARIOS.join(",") },
    seconds: { type: "string", default: "5" },
    rounds: { type: "string", default: "3" },
    storage: { type: "string", default: "{}" },
    base: { type: "string", default: STUDIO_URL },
    out: { type: "string", default: "perf-results/steady.json" },
    profiles: { type: "string", default: "perf-results/steady" }
  }
});

const editors = (await BenchEditors.read()).select(splitList(args.editors));
const mode = MODE_FLAG.parse(args.mode);
const scenarios = z.array(z.enum(VIEWPORT_SCENARIOS)).parse(splitList(args.scenarios));
const durationMs = Number(args.seconds) * 1000;
const storage = STORAGE_FLAG.parse(args.storage);
const results = new ResultsFile(args.out, "steady", args);

for (const { round, item: editor } of alternatingRounds(editors, Number(args.rounds))) {
  try {
    for await (const measurement of measureEditor(editor, round)) {
      results.add(measurement);
    }
  }
  catch (error) {
    console.error(`${round} ${editor.name} failed`, error);
  }
}
printSummary(results);

async function* measureEditor(
  editor: BenchEditor,
  round: number
): AsyncGenerator<SteadyMeasurement> {
  const bench = await BenchBrowser.launch();
  try {
    const session = await StudioSession.start(bench, {
      base: args.base,
      mode,
      storage,
      probe: true,
      cpuThrottle: 1
    });
    const { studio } = session;
    await studio.waitUntilOpenable(editor);
    const frame = await studio.openEditor(editor);
    await studio.page.waitForTimeout(DEFAULT_SETTLE_MS);
    const viewport = await EditorViewport.locate(studio.page, frame);

    for (const scenario of scenarios) {
      await viewport.prepare(scenario);
      await studio.page.waitForTimeout(kBetweenScenariosMs);

      const heapProfile = path.join(
        args.profiles,
        `${editor.name}-${mode}-${scenario}-${round}.heapprofile`
      );
      const { result: pacing, recording } = await session.record(
        { heapProfile },
        async() => {
          await frame.evaluate(startFramePacing, FRAME_PACING_THRESHOLDS);
          await viewport.play(scenario, durationMs);

          return frame.evaluate(stopFramePacing);
        }
      );

      const sample = new SteadySample({
        recording,
        pacing,
        probes: [
          await frame.evaluate(readProbe),
          await studio.page.evaluate(readProbe)
        ]
      });
      const measurement = sample.toMeasurement({
        round,
        editor: editor.name,
        mode,
        scenario
      });
      console.log(
        `${round} ${editor.name.padEnd(11)} ${scenario.padEnd(5)}`,
        `${measurement.allocatedMBPerSecond} MB/s ${measurement.allocatedKBPerFrame} KB/frame`,
        `gc ${pauses(measurement.minorGc)}/${pauses(measurement.majorGc)}`,
        `frames ${measurement.frames} worst ${measurement.worstFrameMs}ms`,
        `renders ${measurement.renders} wakes ${measurement.wakes} idle ${measurement.idleMs}ms`,
        `main ${measurement.taskMsPerSecond}ms/s`
      );

      yield measurement;
    }
    await session.close();
  }
  finally {
    await bench.close();
  }
}

function printSummary(
  measurements: Iterable<SteadyMeasurement>
): void {
  const table = new MarkdownTable(
    ["editor", "scenario", "n", ...kSummaryColumns.map(([title]) => title)],
    { fractionDigits: 1 }
  );
  const groups = MeasurementGroup.groupBy(
    measurements,
    (item) => [item.editor, item.scenario]
  );
  for (const group of groups) {
    table.add([
      group.sample.editor,
      group.sample.scenario,
      group.items.length,
      ...kSummaryColumns.map(([, pick]) => group.median(pick))
    ]);
  }
  console.log(`\n${table}`);
}

function perSecond(
  item: SteadyMeasurement,
  count: number
): number {
  return count / (item.elapsedMs / 1000);
}

function pauses(
  gc: GcPauses
): string {
  return `${gc.count}x${gc.ms}ms`;
}
