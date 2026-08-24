// Import Internal Dependencies
import {
  FrameScheduler,
  type FrameSchedule,
  type FrameSchedulerOptions,
  type FrameTape
} from "../../src/index.ts";

/**
 * Replays deltas after discarding the scheduler's priming frame.
 */
export function replay(
  deltas: number[],
  options: FrameSchedulerOptions = {},
  scheduler = new FrameScheduler(options)
): { scheduler: FrameScheduler; schedules: FrameSchedule[]; } {
  let now = 0;
  scheduler.advance(now);

  const schedules = deltas.map((delta) => {
    now += delta;

    return scheduler.advance(now);
  });

  return { scheduler, schedules };
}

export function replayTape(
  tape: FrameTape
) {
  return replay(tape.deltas, tape.options);
}

export function closeTo(
  actual: number,
  expected: number,
  epsilon = 1e-9
): boolean {
  return Math.abs(actual - expected) <= epsilon;
}
