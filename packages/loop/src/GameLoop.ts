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

// CONSTANTS
const kDefaultTrailingRenders = 2;

export type GameLoopEvents = {
  start: () => void;
  stop: () => void;
  pause: (payload: { paused: boolean; }) => void;
  panic: (payload: { droppedMs: number; steps: number; }) => void;
  /**
   * Reports raw and consumed deltas when a frame is clamped.
   */
  clamp: (payload: { rawDelta: number; frameDelta: number; }) => void;
  sleep: () => void;
  wake: () => void;
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
  keepAlive?: () => boolean;
  trailingRenders?: number;
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
  #timeScale: number;
  #keepAlive: () => boolean;
  #trailingRenders: number;
  #owedRenders = 0;
  #sleeping = false;

  constructor(
    options: GameLoopOptions = {}
  ) {
    super();
    const {
      source,
      keepAlive = () => true,
      trailingRenders = kDefaultTrailingRenders,
      ...schedulerOptions
    } = options;

    if (
      !Number.isInteger(trailingRenders) ||
      trailingRenders < 0
    ) {
      throw new RangeError(
        `trailingRenders must be an integer >= 0, got ${trailingRenders}`
      );
    }

    this.scheduler = new FrameScheduler(schedulerOptions);
    this.#source = source ?? new RafFrameSource();
    this.#timeScale = this.scheduler.timeScale;
    this.#keepAlive = keepAlive;
    this.#trailingRenders = trailingRenders;
  }

  get running(): boolean {
    return this.#running;
  }

  get sleeping(): boolean {
    return this.#sleeping;
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
    this.#sleeping = false;
    this.#oweRenders();
    this.#syncTimeScale();
    this.scheduler.reset();

    this.emit("start");
    this.#source.start(this.#onFrame);

    return this;
  }

  stop(): this {
    if (!this.#running) {
      return this;
    }

    this.#source.stop();
    this.#running = false;
    this.#paused = false;
    this.#sleeping = false;
    this.#syncTimeScale();
    this.emit("stop");

    return this;
  }

  invalidate(): void {
    this.#oweRenders();
    if (!this.#sleeping) {
      return;
    }

    this.#sleeping = false;
    this.scheduler.skipGap();
    this.emit("wake");
    this.#source.start(this.#onFrame);
  }

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
    this.scheduler.timeScale = this.#paused
      ? 0
      : this.#timeScale;
  }

  #oweRenders(): void {
    this.#owedRenders = this.#trailingRenders + 1;
  }

  #sleepWhenIdle(): void {
    if (!this.#running || this.#sleeping) {
      return;
    }

    if (this.#keepAlive()) {
      this.#oweRenders();

      return;
    }

    if (this.#owedRenders > 0) {
      return;
    }

    this.#sleeping = true;
    this.#source.stop();
    this.emit("sleep");
  }

  readonly #onFrame = (
    now: number
  ): void => {
    const schedule = this.scheduler.advance(now);
    if (schedule.render) {
      this.#owedRenders--;
    }

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

    this.#sleepWhenIdle();
  };
}
