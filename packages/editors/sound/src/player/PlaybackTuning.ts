// Import Internal Dependencies
import type { LoopRegion } from "./LoopRegion.ts";

export interface PlaybackTuningInit {
  duration: number;
  rate: number;
  reversed: boolean;
  loop: LoopRegion | null;
}

export class PlaybackTuning {
  readonly duration: number;
  readonly rate: number;
  readonly reversed: boolean;
  readonly loop: LoopRegion | null;

  constructor(
    init: PlaybackTuningInit
  ) {
    this.duration = init.duration;
    this.rate = init.rate;
    this.reversed = init.reversed;
    this.loop = init.loop;
  }

  advance(
    offset: number,
    played: number
  ): number | null {
    const velocity = this.reversed ? -this.rate : this.rate;
    const position = offset + velocity * played;
    if (this.loop !== null) {
      return this.loop.wrap(position, this.reversed);
    }

    const inside = this.reversed ? position > 0 : position < this.duration;

    return inside ? position : null;
  }

  entry(
    position: number
  ): number {
    return this.loop === null || this.reversed ?
      position :
      this.loop.entry(position);
  }

  start(): number {
    return this.reversed ? this.duration : 0;
  }

  end(): number {
    return this.reversed ? 0 : this.duration;
  }

  bufferOffset(
    position: number
  ): number {
    return this.reversed ? this.duration - position : position;
  }
}
