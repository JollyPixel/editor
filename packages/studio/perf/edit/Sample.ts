// Import Third-party Dependencies
import type {
  FramePacing,
  GcPauses,
  InputLatency,
  PageRecording
} from "@jolly-pixel/cdp";

// Import Internal Dependencies
import type { EditScenario } from "./Scenario.ts";
import { round1 } from "../report/round1.ts";
import {
  longFramesWithin,
  type ProbeSnapshot
} from "../studio/pageProbe.ts";
import type { StudioMode } from "../studio/StudioPage.ts";

export interface MeasureTotal {
  count: number;
  totalMs: number;
  maxMs: number;
}

export interface EditMemory {
  allocatedMB: number;
  minorGc: GcPauses;
  majorGc: GcPauses;
  heapProfileFile: string;
}

export interface EditMeasurement {
  label: string;
  run: number;
  mode: StudioMode;
  editor: string;
  scenario: EditScenario;
  textKB: number;
  elapsedMs: number;
  inputs: number;
  latencyP50: number;
  latencyP95: number;
  latencyMax: number;
  inputsOver50: number;
  taskMsPerInput: number;
  scriptMsPerInput: number;
  layoutMsPerInput: number;
  styleMsPerInput: number;
  longFrames: number;
  longFramesMs: number;
  frames: number;
  worstFrameMs: number;
  renders: number;
  socketSentKB: number;
  socketReceivedKB: number;
  measures: Record<string, MeasureTotal>;
  profileFile?: string;
  memory?: EditMemory;
}

export type EditContext = Pick<
  EditMeasurement,
  "label" | "run" | "mode" | "editor" | "scenario" | "textKB"
>;

export interface EditSampleData {
  recording: PageRecording;
  latency: InputLatency;
  pacing: FramePacing;
  probes: Iterable<ProbeSnapshot>;
}

// CONSTANTS
const kSlowInputMs = 50;

export class EditSample {
  readonly #data: EditSampleData;

  constructor(
    data: EditSampleData
  ) {
    if (data.latency.latenciesMs.length === 0) {
      throw new Error("The editor frame recorded no input");
    }

    this.#data = data;
  }

  toMeasurement(
    context: EditContext
  ): EditMeasurement {
    const { recording, latency, pacing, probes } = this.#data;
    const { metrics, memory } = recording;
    const latencies = latency.latenciesMs.toSorted((left, right) => left - right);
    const inputs = latencies.length;
    const probeList = [...probes];
    const longFrames = longFramesWithin(probeList, latency.startedAt, latency.endedAt);
    function perInput(seconds: number): number {
      return round1((seconds * 1000) / inputs);
    }

    return {
      ...context,
      elapsedMs: Math.round(latency.endedAt - latency.startedAt),
      inputs,
      latencyP50: percentile(latencies, 0.5),
      latencyP95: percentile(latencies, 0.95),
      latencyMax: latencies[inputs - 1],
      inputsOver50: latencies.filter((value) => value > kSlowInputMs).length,
      taskMsPerInput: perInput(metrics.change("TaskDuration")),
      scriptMsPerInput: perInput(metrics.change("ScriptDuration")),
      layoutMsPerInput: perInput(metrics.change("LayoutDuration")),
      styleMsPerInput: perInput(metrics.change("RecalcStyleDuration")),
      longFrames: longFrames.length,
      longFramesMs: Math.round(longFrames.reduce((total, { duration }) => total + duration, 0)),
      frames: pacing.frames,
      worstFrameMs: pacing.worstMs,
      renders: pacing.renders,
      socketSentKB: round1(recording.socketSentBytes / 1024),
      socketReceivedKB: round1(recording.socketBytes / 1024),
      measures: measureTotals(probeList, latency),
      profileFile: recording.cpuProfileFile,
      memory: memory === undefined ? undefined : {
        allocatedMB: round1(memory.allocatedBytes / 1e6),
        minorGc: memory.gc.minor,
        majorGc: memory.gc.major,
        heapProfileFile: memory.heapProfileFile
      }
    };
  }
}

function measureTotals(
  probes: Iterable<ProbeSnapshot>,
  window: InputLatency
): Record<string, MeasureTotal> {
  const totals: Record<string, MeasureTotal> = {};
  for (const { steps } of probes) {
    for (const { name, start, end } of steps) {
      if (start < window.startedAt || start > window.endedAt) {
        continue;
      }
      const total = totals[name] ?? {
        count: 0,
        totalMs: 0,
        maxMs: 0
      };
      total.count++;
      total.totalMs = round1(total.totalMs + end - start);
      total.maxMs = round1(Math.max(total.maxMs, end - start));
      totals[name] = total;
    }
  }

  return totals;
}

function percentile(
  sorted: readonly number[],
  rank: number
): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * rank) - 1)];
}
