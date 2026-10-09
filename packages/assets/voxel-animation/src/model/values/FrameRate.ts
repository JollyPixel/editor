// CONSTANTS
export const TICKS_PER_SECOND = 24000;

export class FrameRate {
  static isValid(
    fps: number
  ): boolean {
    return Number.isInteger(fps) && fps > 0 && TICKS_PER_SECOND % fps === 0;
  }

  readonly fps: number;
  readonly ticksPerFrame: number;

  constructor(
    fps: number
  ) {
    if (!FrameRate.isValid(fps)) {
      throw new RangeError(`${fps} fps does not divide the tick rate`);
    }

    this.fps = fps;
    this.ticksPerFrame = TICKS_PER_SECOND / fps;
  }

  toTick(
    frame: number
  ): number {
    return Math.round(frame * this.ticksPerFrame);
  }

  toFrame(
    tick: number
  ): number {
    return tick / this.ticksPerFrame;
  }

  frameAt(
    tick: number
  ): number {
    return Math.round(this.toFrame(tick));
  }

  snap(
    tick: number
  ): number {
    return this.toTick(this.frameAt(tick));
  }
}
