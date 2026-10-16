// Import Internal Dependencies
import type { ViewportScenario } from "./EditorViewport.ts";
import type { FramePacing } from "./framePacing.ts";
import {
  longFramesWithin,
  type ProbeSnapshot
} from "./openProbe.ts";
import type { StudioMode } from "./StudioPage.ts";
import type {
  MemoryRecording,
  SessionRecording
} from "./StudioSession.ts";
import type { GcPauses } from "../analysis/Trace.ts";

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
  recording: SessionRecording;
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
