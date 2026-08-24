// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { FrameSchedule } from "./FrameSchedule.ts";
import {
  FrameScheduler,
  type FrameSchedulerOptions
} from "./FrameScheduler.ts";
import type { FrameSource } from "./FrameSource.ts";
import { RafFrameSource } from "./sources/RafFrameSource.ts";

export type GameLoopEvents = {
  start: () => void;
  stop: () => void;
  pause: (payload: { paused: boolean; }) => void;
  panic: (payload: { droppedMs: number; steps: number; }) => void;
  /**
   * Reports raw and consumed deltas when a frame is clamped.
   */
  clamp: (payload: { rawDelta: number; frameDelta: number; }) => void;
};

export interface GameLoopCallbacks {
  /**
   * Runs once per fixed step with a millisecond delta.
   */
  fixedUpdate?: (
    fixedDeltaMs: number,
    stepIndex: number
  ) => void;
  /**
   * Runs after fixed steps on rendered frames.
   */
  update?: (
    frameDeltaMs: number,
    alpha: number
  ) => void;
  /**
   * Runs before fixed steps on every source frame.
   */
  frame?: (
    schedule: FrameSchedule,
    now: number
  ) => void;
}

export interface GameLoopOptions extends FrameSchedulerOptions {
  /**
   * Defaults to `RafFrameSource`.
   */
  source?: FrameSource;
}

/**
 * Connects a frame source and scheduler to host callbacks.
 * Configure scheduling through `scheduler`; set pause-aware `timeScale` here.
 */
export class GameLoop extends Emitter<GameLoopEvents> {
  readonly scheduler: FrameScheduler;

  #source: FrameSource;
  #callbacks: GameLoopCallbacks = {};
  #running = false;
  #paused = false;
  // Stores the requested scale while pausing applies zero to the scheduler.
  #timeScale: number;

  constructor(
    options: GameLoopOptions = {}
  ) {
    super();
    const {
      source,
      ...schedulerOptions
    } = options;

    this.scheduler = new FrameScheduler(schedulerOptions);
    this.#source = source ?? new RafFrameSource();
    this.#timeScale = this.scheduler.timeScale;
  }

  get running(): boolean {
    return this.#running;
  }

  get paused(): boolean {
    return this.#paused;
  }

  get source(): FrameSource {
    return this.#source;
  }

  get timeScale(): number {
    return this.#timeScale;
  }

  set timeScale(
    value: number
  ) {
    this.scheduler.timeScale = value;
    this.#timeScale = value;
    this.#syncTimeScale();
  }

  /**
   * Resets scheduling and starts the source.
   * Omitted callbacks retain the previous set.
   */
  start(
    callbacks?: GameLoopCallbacks
  ): this {
    if (this.#running) {
      throw new Error("GameLoop is already running");
    }
    if (callbacks) {
      this.#callbacks = callbacks;
    }

    this.#running = true;
    this.#paused = false;
    this.#syncTimeScale();
    this.scheduler.reset();
    // Emit before a source can synchronously deliver its first frame.
    this.emit("start");
    this.#source.start(
      (now) => this.#onFrame(now)
    );

    return this;
  }

  stop(): this {
    if (!this.#running) {
      return this;
    }

    this.#source.stop();
    this.#running = false;
    this.#paused = false;
    this.#syncTimeScale();
    this.emit("stop");

    return this;
  }

  /**
   * Stops simulation steps while frames and rendering continue.
   */
  pause(): this {
    if (this.#paused) {
      return this;
    }

    this.#paused = true;
    this.#syncTimeScale();
    this.emit(
      "pause",
      { paused: true }
    );

    return this;
  }

  resume(): this {
    if (!this.#paused) {
      return this;
    }

    this.#paused = false;
    this.#syncTimeScale();
    this.emit(
      "pause",
      { paused: false }
    );

    return this;
  }

  #syncTimeScale(): void {
    this.scheduler.timeScale = this.#paused ? 0 : this.#timeScale;
  }

  #onFrame(
    now: number
  ): void {
    const schedule = this.scheduler.advance(now);

    if (schedule.clamped) {
      this.emit("clamp", {
        rawDelta: schedule.rawDelta,
        frameDelta: schedule.frameDelta
      });
    }
    if (schedule.panicked) {
      this.emit("panic", {
        droppedMs: schedule.droppedMs,
        steps: schedule.steps
      });
    }

    const {
      fixedUpdate,
      update,
      frame
    } = this.#callbacks;
    frame?.(schedule, now);

    for (let stepIndex = 0; stepIndex < schedule.steps; stepIndex++) {
      fixedUpdate?.(
        schedule.fixedDelta,
        stepIndex
      );
    }

    if (schedule.render) {
      update?.(
        schedule.frameDelta,
        schedule.alpha
      );
    }
  }
}
