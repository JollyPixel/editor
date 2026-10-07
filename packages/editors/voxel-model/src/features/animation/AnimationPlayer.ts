// Import Third-party Dependencies
import { TICKS_PER_SECOND } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type { AnimationSession } from "./AnimationSession.ts";

export interface PlaybackClock {
  /** Milliseconds. */
  now(): number;
  frame(callback: () => void): number;
  cancel(handle: number): void;
}

export interface AnimationPlayerOptions {
  session: Pick<AnimationSession, "focused" | "playback" | "seek" | "pause" | "subscribe">;
  clock?: PlaybackClock;
}

interface Run {
  startedAt: number;
  startTick: number;
  handle: number;
}

const kBrowserClock: PlaybackClock = {
  now: () => performance.now(),
  frame: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle)
};

export class AnimationPlayer {
  #session: AnimationPlayerOptions["session"];
  #clock: PlaybackClock;
  #run: Run | null = null;
  #written: number | null = null;
  #unsubscribe: () => void;

  constructor(
    options: AnimationPlayerOptions
  ) {
    this.#session = options.session;
    this.#clock = options.clock ?? kBrowserClock;
    this.#unsubscribe = this.#session.subscribe("playhead", this.#sync);
  }

  dispose(): void {
    this.#unsubscribe();
    this.#stop();
  }

  readonly #sync = (): void => {
    const { playing, tick } = this.#session.playback;
    if (!playing) {
      this.#stop();

      return;
    }
    if (this.#run === null || tick !== this.#written) {
      this.#start(tick);
    }
  };

  #start(
    tick: number
  ): void {
    this.#stop();
    this.#run = {
      startedAt: this.#clock.now(),
      startTick: tick,
      handle: this.#clock.frame(this.#advance)
    };
  }

  #stop(): void {
    if (this.#run !== null) {
      this.#clock.cancel(this.#run.handle);
      this.#run = null;
    }
    this.#written = null;
  }

  readonly #advance = (): void => {
    const run = this.#run;
    const clip = this.#session.focused?.clip;
    if (run === null) {
      return;
    }
    if (clip === undefined) {
      this.#session.pause();

      return;
    }

    let elapsed = run.startTick +
      ((this.#clock.now() - run.startedAt) * TICKS_PER_SECOND / 1000);
    if (this.#session.playback.loop && elapsed >= clip.length) {
      const passes = clip.length * Math.floor(elapsed / clip.length);
      run.startTick -= passes;
      elapsed -= passes;
    }
    const tick = Math.round(Math.min(elapsed, clip.length));
    this.#written = tick;
    this.#session.seek(tick);
    if (elapsed >= clip.length) {
      this.#session.pause();

      return;
    }
    run.handle = this.#clock.frame(this.#advance);
  };
}
