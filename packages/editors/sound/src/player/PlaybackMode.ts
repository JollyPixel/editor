// Import Third-party Dependencies
import * as z from "zod/mini";

// CONSTANTS
export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4] as const;

export type PlaybackSpeed = typeof PLAYBACK_SPEEDS[number];

export interface PlaybackModeSnapshot {
  readonly loop: boolean;
  readonly reversed: boolean;
  readonly speed: PlaybackSpeed;
}

export class PlaybackMode {
  static readonly schema = z.object({
    loop: z.boolean(),
    reversed: z.boolean(),
    speed: z.literal(PLAYBACK_SPEEDS)
  });
  static readonly default = new PlaybackMode({
    loop: false,
    reversed: false,
    speed: 1
  });

  readonly loop: boolean;
  readonly reversed: boolean;
  readonly speed: PlaybackSpeed;

  constructor(
    snapshot: PlaybackModeSnapshot
  ) {
    this.loop = snapshot.loop;
    this.reversed = snapshot.reversed;
    this.speed = snapshot.speed;
  }

  withLoop(
    loop: boolean
  ): PlaybackMode {
    return this.#with({ loop });
  }

  withReversed(
    reversed: boolean
  ): PlaybackMode {
    return this.#with({ reversed });
  }

  withSpeed(
    speed: PlaybackSpeed
  ): PlaybackMode {
    return this.#with({ speed });
  }

  advance(
    offset: number,
    played: number,
    duration: number
  ): number | null {
    const velocity = this.reversed ? -this.speed : this.speed;
    const position = offset + velocity * played;
    if (this.loop) {
      return (position % duration + duration) % duration;
    }

    const inside = this.reversed ? position > 0 : position < duration;

    return inside ? position : null;
  }

  start(
    duration: number
  ): number {
    return this.reversed ? duration : 0;
  }

  end(
    duration: number
  ): number {
    return this.reversed ? 0 : duration;
  }

  bufferOffset(
    position: number,
    duration: number
  ): number {
    return this.reversed ? duration - position : position;
  }

  toJSON(): PlaybackModeSnapshot {
    return {
      loop: this.loop,
      reversed: this.reversed,
      speed: this.speed
    };
  }

  #with(
    patch: Partial<PlaybackModeSnapshot>
  ): PlaybackMode {
    return new PlaybackMode({
      ...this.toJSON(),
      ...patch
    });
  }
}
