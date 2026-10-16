// Import Internal Dependencies
import type {
  ProbeFrame,
  ProbeSnapshot
} from "./pageProbe.ts";
import type { StudioMode } from "./StudioPage.ts";

// CONSTANTS
export const PHASES = ["first", "reopen", "reload", "cold"] as const;

export type Phase = typeof PHASES[number];

export interface FrameSummary {
  count: number;
  total: number;
  blocking: number;
  longest: number;
}

export interface OpenStep {
  start: number;
  end: number;
  ms: number;
}

export interface OpenMeasurement {
  label: string;
  run: number;
  mode: StudioMode;
  editor: string;
  phase: Phase;
  clickToFrame: number;
  clickToDomContentLoaded: number;
  clickToReady: number;
  clickToSettled: number;
  steps: Record<string, OpenStep>;
  framesBeforeReady: FrameSummary;
  framesAfterReady: FrameSummary;
  longFrames: (ProbeFrame & { at: number; })[];
  cdp: {
    scriptMs: number;
    taskMs: number;
    layoutMs: number;
    styleMs: number;
    heapDeltaMB: number;
    nodesDelta: number;
  };
  requests: number;
  transferKB: number;
  decodedKB: number;
  socketKB: number;
  profileFile?: string;
}

export type OpenContext = Pick<
  OpenMeasurement,
  "label" | "run" | "mode" | "editor" | "phase" | "profileFile"
>;

export interface OpenSampleData {
  shell: ProbeSnapshot;
  frame: ProbeSnapshot;
  metricsBefore: Map<string, number>;
  metricsAfter: Map<string, number>;
  socketBytes: number;
  settleMs: number;
}

export class OpenSample {
  readonly click: number;
  readonly ready: number;
  readonly #data: OpenSampleData;

  constructor(
    data: OpenSampleData
  ) {
    const click = data.shell.clicks.at(-1);
    if (click === undefined) {
      throw new Error("The shell recorded no dblclick");
    }
    const ready = data.frame.states.find(({ state }) => state === "ready");
    if (ready === undefined) {
      throw new Error("The editor frame never recorded data-editor-state=ready");
    }

    this.click = click;
    this.ready = ready.t;
    this.#data = data;
  }

  toMeasurement(
    context: OpenContext
  ): OpenMeasurement {
    const { frame, socketBytes } = this.#data;
    const frames = this.#framesInWindow();
    const settled = Math.max(
      this.ready,
      ...frames.map(({ t, duration }) => t + duration)
    );

    return {
      ...context,
      clickToFrame: this.#sinceClick(frame.timeOrigin),
      clickToDomContentLoaded: this.#sinceClick(frame.timeOrigin + frame.domContentLoaded),
      clickToReady: this.#sinceClick(this.ready),
      clickToSettled: this.#sinceClick(settled),
      steps: this.#steps(),
      framesBeforeReady: this.#summarize(frames.filter(({ t }) => t < this.ready)),
      framesAfterReady: this.#summarize(frames.filter(({ t }) => t >= this.ready)),
      longFrames: frames.map((longFrame) => {
        return {
          ...longFrame,
          at: this.#sinceClick(longFrame.t)
        };
      }),
      cdp: {
        scriptMs: Math.round(this.#metricDelta("ScriptDuration") * 1000),
        taskMs: Math.round(this.#metricDelta("TaskDuration") * 1000),
        layoutMs: Math.round(this.#metricDelta("LayoutDuration") * 1000),
        styleMs: Math.round(this.#metricDelta("RecalcStyleDuration") * 1000),
        heapDeltaMB: Math.round(this.#metricDelta("JSHeapUsedSize") / 1e5) / 10,
        nodesDelta: this.#metricDelta("Nodes")
      },
      requests: frame.requests,
      transferKB: Math.round(frame.transferBytes / 1024),
      decodedKB: Math.round(frame.decodedBytes / 1024),
      socketKB: Math.round(socketBytes / 1024)
    };
  }

  #framesInWindow(): ProbeFrame[] {
    const end = this.ready + this.#data.settleMs;

    return [...this.#data.frame.frames, ...this.#data.shell.frames]
      .filter(({ t }) => t >= this.click && t <= end);
  }

  #steps(): Record<string, OpenStep> {
    const steps: Record<string, OpenStep> = {};
    for (const { name, start, end } of this.#data.frame.steps) {
      steps[name] = {
        start: this.#sinceClick(start),
        end: this.#sinceClick(end),
        ms: Math.round(end - start)
      };
    }

    return steps;
  }

  #summarize(
    frames: ProbeFrame[]
  ): FrameSummary {
    return {
      count: frames.length,
      total: Math.round(frames.reduce((total, { duration }) => total + duration, 0)),
      blocking: Math.round(frames.reduce((total, { blocking }) => total + blocking, 0)),
      longest: Math.round(Math.max(0, ...frames.map(({ duration }) => duration)))
    };
  }

  #metricDelta(
    name: string
  ): number {
    return (this.#data.metricsAfter.get(name) ?? 0) -
      (this.#data.metricsBefore.get(name) ?? 0);
  }

  #sinceClick(
    time: number
  ): number {
    return Math.round(time - this.click);
  }
}
