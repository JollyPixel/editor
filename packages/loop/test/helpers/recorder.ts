// Import Internal Dependencies
import type { FrameSchedule } from "../../src/index.ts";

export interface Recorder {
  fixedUpdate: [number, number][];
  update: [number, number][];
  frames: FrameSchedule[];
  timestamps: number[];
}

export function record(): {
  recorder: Recorder;
  callbacks: {
    fixedUpdate: (
      delta: number,
      stepIndex: number
    ) => void;
    update: (
      delta: number,
      alpha: number
    ) => void;
    frame: (
      schedule: FrameSchedule,
      now: number
    ) => void;
  };
} {
  const recorder: Recorder = {
    fixedUpdate: [],
    update: [],
    frames: [],
    timestamps: []
  };

  return {
    recorder,
    callbacks: {
      fixedUpdate: (delta, stepIndex) => {
        recorder.fixedUpdate.push([
          delta,
          stepIndex
        ]);
      },
      update: (delta, alpha) => {
        recorder.update.push([
          delta,
          alpha
        ]);
      },
      frame: (schedule, now) => {
        recorder.frames.push(schedule);
        recorder.timestamps.push(now);
      }
    }
  };
}
