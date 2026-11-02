// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import { PlaybackMode } from "../player/PlaybackMode.ts";
import type { SoundPlayer } from "../player/SoundPlayer.ts";

// CONSTANTS
const kDriftTolerance = 0.04;
const kPlaybackMarkSchema = z.object({
  at: z.number(),
  offset: z.number().check(z.nonnegative()),
  mode: PlaybackMode.schema,
  listening: z.boolean()
});

export type PlaybackMarkSnapshot = Readonly<z.infer<typeof kPlaybackMarkSchema>>;

export interface PlaybackMarkInit {
  at: number;
  offset: number;
  mode: PlaybackMode;
  listening: boolean;
}

export class PlaybackMark {
  static parse(
    value: unknown
  ): PlaybackMark | null | undefined {
    if (value === null) {
      return null;
    }

    const result = z.safeParse(kPlaybackMarkSchema, value);

    return result.success ?
      new PlaybackMark({
        ...result.data,
        mode: new PlaybackMode(result.data.mode)
      }) :
      undefined;
  }

  static capture(
    player: SoundPlayer,
    listening: boolean
  ): PlaybackMark | null {
    const { elapsed, mode } = player;

    return elapsed === null ? null : new PlaybackMark({
      at: Date.now(),
      offset: elapsed,
      mode,
      listening
    });
  }

  readonly at: number;
  readonly offset: number;
  readonly mode: PlaybackMode;
  readonly listening: boolean;

  constructor(
    init: PlaybackMarkInit
  ) {
    this.at = init.at;
    this.offset = init.offset;
    this.mode = init.mode;
    this.listening = init.listening;
  }

  elapsed(
    duration: number
  ): number | null {
    const played = Math.max(0, Date.now() - this.at) / 1000;

    return this.mode.advance(this.offset, played, duration);
  }

  mirrorInto(
    player: SoundPlayer
  ): void {
    const { duration, elapsed: current } = player;
    const elapsed = duration === null ? null : this.elapsed(duration);
    if (elapsed === null) {
      player.pause();
    }
    else if (current !== null && Math.abs(current - elapsed) < kDriftTolerance) {
      player.retune(this.mode);
    }
    else {
      player.play(elapsed, this.mode);
    }
  }

  toJSON(): PlaybackMarkSnapshot {
    return {
      at: this.at,
      offset: this.offset,
      mode: this.mode.toJSON(),
      listening: this.listening
    };
  }
}
