// Import Internal Dependencies
import { ManualClock } from "../Clock.ts";
import type {
  FrameCallback,
  FrameSource
} from "../FrameSource.ts";
import type { FrameSchedulerOptions } from "../FrameScheduler.ts";

/**
 * Named frame deltas and scheduler options replayed through `run()`.
 */
export interface FrameTape {
  name: string;
  /**
   * Lag behavior represented by the tape.
   */
  description: string;
  options: FrameSchedulerOptions;
  /**
   * Raw frame deltas in milliseconds.
   */
  deltas: number[];
}

/**
 * Emits frames only through `start()`, `step()`, or `run()`.
 */
export class ManualFrameSource implements FrameSource {
  readonly clock: ManualClock;

  #callback: FrameCallback | null = null;

  constructor(
    clock: ManualClock = new ManualClock()
  ) {
    this.clock = clock;
  }

  get running(): boolean {
    return this.#callback !== null;
  }

  /**
   * Registers the callback and synchronously emits a priming frame.
   */
  start(
    callback: FrameCallback
  ): void {
    this.#callback = callback;
    callback(
      this.clock.now()
    );
  }

  stop(): void {
    this.#callback = null;
  }

  step(
    deltaMs = 0
  ): number {
    if (this.#callback === null) {
      throw new Error("ManualFrameSource.step() called while stopped");
    }

    const now = this.clock.advance(deltaMs);
    this.#callback(now);

    return now;
  }

  run(
    tape: number[] | FrameTape
  ): void {
    const deltas = Array.isArray(tape) ? tape : tape.deltas;
    for (const delta of deltas) {
      this.step(delta);
    }
  }
}
