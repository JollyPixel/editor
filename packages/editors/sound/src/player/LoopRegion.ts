// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/ecs";

export type LoopSettings = Pick<
  Systems.SoundSettings,
  "loop" | "loopStart" | "loopEnd"
>;

export class LoopRegion {
  static whole(
    duration: number
  ): LoopRegion {
    return new LoopRegion(0, duration);
  }

  static resolve(
    settings: Readonly<LoopSettings>,
    duration: number
  ): LoopRegion | null {
    if (!settings.loop) {
      return null;
    }

    const { loopStart, loopEnd } = settings;
    const start = loopStart < 0 || loopStart >= duration ? 0 : loopStart;
    const end = loopEnd <= 0 || loopEnd > duration ? duration : loopEnd;

    return start < end ?
      new LoopRegion(start, end) :
      LoopRegion.whole(duration);
  }

  readonly start: number;
  readonly end: number;

  constructor(
    start: number,
    end: number
  ) {
    this.start = start;
    this.end = end;
  }

  get length(): number {
    return this.end - this.start;
  }

  entry(
    position: number
  ): number {
    return position >= this.end ? this.start : position;
  }

  wrap(
    position: number,
    reversed: boolean
  ): number {
    if (reversed ? position >= this.start : position < this.end) {
      return position;
    }

    const travelled = reversed ?
      this.end - position :
      position - this.start;
    const into = travelled % this.length;

    return reversed ? this.end - into : this.start + into;
  }
}
