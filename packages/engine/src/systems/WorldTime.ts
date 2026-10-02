// Import Third-party Dependencies
import type { FrameSchedule } from "@jolly-pixel/loop";

export class WorldTime {
  #delta = 0;
  #unscaledDelta = 0;
  #elapsed = 0;
  #unscaledElapsed = 0;
  #fixedElapsed = 0;

  get delta(): number {
    return this.#delta;
  }

  get unscaledDelta(): number {
    return this.#unscaledDelta;
  }

  get elapsed(): number {
    return this.#elapsed;
  }

  get unscaledElapsed(): number {
    return this.#unscaledElapsed;
  }

  get fixedElapsed(): number {
    return this.#fixedElapsed;
  }

  advanceFrame(
    schedule: FrameSchedule
  ): void {
    this.#delta = schedule.frameDelta / 1000;
    this.#unscaledDelta = schedule.unscaledDelta / 1000;
    this.#elapsed += this.#delta;
    this.#unscaledElapsed += this.#unscaledDelta;
  }

  advanceStep(
    fixedDelta: number
  ): void {
    this.#fixedElapsed += fixedDelta;
  }
}
