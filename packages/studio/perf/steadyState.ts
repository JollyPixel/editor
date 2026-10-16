// Import Node.js Dependencies
import {
  mkdirSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

// Import Internal Dependencies
import type { GcPauses } from "./analysis/Trace.ts";
import { BenchBrowser } from "./harness/BenchBrowser.ts";
import {
  BenchEditors,
  STUDIO_URL,
  type BenchEditor
} from "./harness/BenchEditors.ts";
import {
  EditorViewport,
  VIEWPORT_SCENARIOS,
  type ViewportScenario
} from "./harness/EditorViewport.ts";
import {
  MODES_SCHEMA,
  STORAGE_SCHEMA
} from "./harness/OpenPlan.ts";
import { DEFAULT_SETTLE_MS } from "./harness/OpenRun.ts";
import {
  readProbe,
  startFramePacing,
  stopFramePacing
} from "./harness/pageProbe.ts";
import type { StudioMode } from "./harness/StudioPage.ts";
import { StudioSession } from "./harness/StudioSession.ts";

interface SteadyMeasurement {
  round: number;
  editor: string;
  mode: StudioMode;
  scenario: ViewportScenario;
  elapsedMs: number;
  allocatedMBPerSecond: number;
  allocatedKBPerFrame: number;
  heapGrowthMB: number;
  taskMsPerSecond: number;
  scriptMsPerSecond: number;
  minorGc: GcPauses;
  majorGc: GcPauses;
  frames: number;
  worstFrameMs: number;
  longFrames: number;
  longFramesMs: number;
  heapProfileFile: string;
}

// CONSTANTS
const kBetweenScenariosMs = 500;
const kSchema = MODES_SCHEMA.element;

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

const editors = (await BenchEditors.read()).select(list(args.editors));
const mode = kSchema.parse(args.mode);
const scenarios = list(args.scenarios).map((name) => {
  if (!VIEWPORT_SCENARIOS.includes(name as ViewportScenario)) {
    throw new Error(`Unknown scenario "${name}"`);
  }

  return name as ViewportScenario;
});
const durationMs = Number(args.seconds) * 1000;
const storage = STORAGE_SCHEMA.parse(JSON.parse(args.storage));
const measurements: SteadyMeasurement[] = [];
mkdirSync(args.profiles, { recursive: true });

for (let round = 0; round < Number(args.rounds); round++) {
  const order = round % 2 === 0 ? editors : editors.toReversed();
  for (const editor of order) {
    try {
      measurements.push(...await measureEditor(editor, round));
    }
    catch (error) {
      console.error(`${round} ${editor.name} failed`, error);
    }
    writeResults();
  }
}
printSummary();

async function measureEditor(
  editor: BenchEditor,
  round: number
): Promise<SteadyMeasurement[]> {
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

    const results: SteadyMeasurement[] = [];
    for (const scenario of scenarios) {
      await viewport.prepare(scenario);
      await studio.page.waitForTimeout(kBetweenScenariosMs);

      const metricsBefore = await session.metrics();
      await session.startMemory();
      const started = await frame.evaluate(now);
      await frame.evaluate(startFramePacing);
      await viewport.play(scenario, durationMs);
      const pacing = await frame.evaluate(stopFramePacing);
      const ended = await frame.evaluate(now);
      const recording = await session.stopMemory();
      const metricsAfter = await session.metrics();

      const longFrames = [
        ...(await frame.evaluate(readProbe)).frames,
        ...(await studio.page.evaluate(readProbe)).frames
      ].filter(({ t }) => t >= started && t <= ended);
      const heapProfileFile = path.join(
        args.profiles,
        `${editor.name}-${mode}-${scenario}-${round}.heapprofile`
      );
      writeFileSync(heapProfileFile, JSON.stringify(recording.heapProfile));

      const seconds = pacing.elapsedMs / 1000;
      const metrics = {
        before: metricsBefore,
        after: metricsAfter
      };
      const measurement: SteadyMeasurement = {
        round,
        editor: editor.name,
        mode,
        scenario,
        elapsedMs: pacing.elapsedMs,
        allocatedMBPerSecond: round1(recording.allocatedBytes / 1e6 / seconds),
        allocatedKBPerFrame: round1(recording.allocatedBytes / 1024 / Math.max(1, pacing.frames)),
        heapGrowthMB: round1(metricDelta(metrics, "JSHeapUsedSize") / 1e6),
        taskMsPerSecond: Math.round(metricDelta(metrics, "TaskDuration") * 1000 / seconds),
        scriptMsPerSecond: Math.round(metricDelta(metrics, "ScriptDuration") * 1000 / seconds),
        minorGc: recording.gc.minor,
        majorGc: recording.gc.major,
        frames: pacing.frames,
        worstFrameMs: pacing.worstMs,
        longFrames: longFrames.length,
        longFramesMs: Math.round(longFrames.reduce((total, { duration }) => total + duration, 0)),
        heapProfileFile
      };
      console.log(
        `${round} ${editor.name.padEnd(11)} ${scenario.padEnd(5)}`,
        `${measurement.allocatedMBPerSecond} MB/s ${measurement.allocatedKBPerFrame} KB/frame`,
        `gc ${pauses(measurement.minorGc)}/${pauses(measurement.majorGc)}`,
        `frames ${measurement.frames} worst ${measurement.worstFrameMs}ms`,
        `main ${measurement.taskMsPerSecond}ms/s`
      );
      results.push(measurement);
    }
    await session.close();

    return results;
  }
  finally {
    await bench.close();
  }
}

function pauses(
  gc: GcPauses
): string {
  return `${gc.count}x${gc.ms}ms`;
}

function now(): number {
  return performance.timeOrigin + performance.now();
}

function writeResults(): void {
  mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  writeFileSync(args.out, JSON.stringify({
    setup: args,
    measurements
  }, null, 2));
}

function printSummary(): void {
  const columns: [string, (item: SteadyMeasurement) => number][] = [
    ["main thread ms/s", (item) => item.taskMsPerSecond],
    ["script ms/s", (item) => item.scriptMsPerSecond],
    ["MB/s", (item) => item.allocatedMBPerSecond],
    ["KB/frame", (item) => item.allocatedKBPerFrame],
    ["minor GC/s", (item) => round1(item.minorGc.count / (item.elapsedMs / 1000))],
    ["GC ms/s", (item) => round1((item.minorGc.ms + item.majorGc.ms) / (item.elapsedMs / 1000))],
    ["major GCs", (item) => item.majorGc.count],
    ["frames/s", (item) => round1(item.frames / (item.elapsedMs / 1000))],
    ["worst frame ms", (item) => item.worstFrameMs],
    ["long frames ms", (item) => item.longFramesMs],
    ["heap growth MB", (item) => item.heapGrowthMB]
  ];
  console.log();
  console.log(`| editor | scenario | n | ${columns.map(([title]) => title).join(" | ")} |`);
  console.log(`|${" --- |".repeat(columns.length + 3)}`);
  for (const editor of editors) {
    for (const scenario of scenarios) {
      const items = measurements.filter(
        (item) => item.editor === editor.name && item.scenario === scenario
      );
      if (items.length === 0) {
        continue;
      }
      const cells = columns.map(([, pick]) => median(items.map(pick)));
      console.log(`| ${editor.name} | ${scenario} | ${items.length} | ${cells.join(" | ")} |`);
    }
  }
}

function median(
  values: number[]
): number {
  const sorted = values.toSorted((left, right) => left - right);
  const middle = sorted.length >> 1;

  return round1(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

function round1(
  value: number
): number {
  return Math.round(value * 10) / 10;
}

function list(
  value: string
): string[] {
  return value.split(",").filter((item) => item !== "");
}

function metricDelta(
  metrics: Record<"before" | "after", Map<string, number>>,
  name: string
): number {
  return (metrics.after.get(name) ?? 0) - (metrics.before.get(name) ?? 0);
}
