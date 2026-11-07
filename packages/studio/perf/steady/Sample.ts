// Import Third-party Dependencies
import type {
  FramePacing,
  GcPauses,
  MemoryRecording,
  PageRecording
} from "@jolly-pixel/cdp";

// Import Internal Dependencies
import type { ViewportScenario } from "./Viewport.ts";
import {
  longFramesWithin,
  type ProbeSnapshot
} from "../studio/pageProbe.ts";
import type { StudioMode } from "../studio/StudioPage.ts";

export interface SteadyMeasurement {
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
  renders: number;
  wakes: number;
  idleMs: number;
  heapProfileFile: string;
}

export type SteadyContext = Pick<
  SteadyMeasurement,
  "round" | "editor" | "mode" | "scenario"
>;

export interface SteadySampleData {
  recording: PageRecording;
  pacing: FramePacing;
  probes: Iterable<ProbeSnapshot>;
}

export class SteadySample {
  readonly #data: SteadySampleData;
  readonly #memory: MemoryRecording;

  constructor(
    data: SteadySampleData
  ) {
    const { memory } = data.recording;
    if (memory === undefined) {
      throw new Error("A steady sample needs a heap profile recording");
    }

    this.#data = data;
    this.#memory = memory;
  }

  toMeasurement(
    context: SteadyContext
  ): SteadyMeasurement {
    const { recording: { metrics }, pacing, probes } = this.#data;
    const { allocatedBytes, gc, heapProfileFile } = this.#memory;
    const seconds = pacing.elapsedMs / 1000;
    const longFrames = longFramesWithin(probes, pacing.startedAt, pacing.endedAt);

    return {
      ...context,
      elapsedMs: pacing.elapsedMs,
      allocatedMBPerSecond: round1(allocatedBytes / 1e6 / seconds),
      allocatedKBPerFrame: round1(allocatedBytes / 1024 / Math.max(1, pacing.frames)),
      heapGrowthMB: round1(metrics.change("JSHeapUsedSize") / 1e6),
      taskMsPerSecond: Math.round(metrics.change("TaskDuration") * 1000 / seconds),
      scriptMsPerSecond: Math.round(metrics.change("ScriptDuration") * 1000 / seconds),
      minorGc: gc.minor,
      majorGc: gc.major,
      frames: pacing.frames,
      worstFrameMs: pacing.worstMs,
      longFrames: longFrames.length,
      longFramesMs: Math.round(longFrames.reduce((total, { duration }) => total + duration, 0)),
      renders: pacing.renders,
      wakes: pacing.wakes,
      idleMs: pacing.idleMs,
      heapProfileFile
    };
  }
}

function round1(
  value: number
): number {
  return Math.round(value * 10) / 10;
}
