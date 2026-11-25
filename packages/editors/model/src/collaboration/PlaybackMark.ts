// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  PLAYBACK_SPEEDS,
  PLAYBACK_STATES,
  type AnimationPlayer,
  type PlaybackSpeed,
  type PlaybackState
} from "../player/AnimationPlayer.ts";

// CONSTANTS
const kDriftTolerance = 0.05;
const kPlaybackMarkSchema = z.object({
  clip: z.string(),
  at: z.number(),
  time: z.number().check(z.nonnegative()),
  state: z.enum(PLAYBACK_STATES),
  loop: z.boolean(),
  speed: z.literal(PLAYBACK_SPEEDS)
});

export type PlaybackMarkSnapshot = Readonly<z.infer<typeof kPlaybackMarkSchema>>;

export class PlaybackMark {
  static parse(
    value: unknown
  ): PlaybackMark | null | undefined {
    if (value === null) {
      return null;
    }

    const result = z.safeParse(kPlaybackMarkSchema, value);

    return result.success ? new PlaybackMark(result.data) : undefined;
  }

  static capture(
    player: AnimationPlayer
  ): PlaybackMark | null {
    const clip = player.selected;

    return clip === null ? null : new PlaybackMark({
      clip,
      at: Date.now(),
      time: player.time,
      state: player.state,
      loop: player.loop,
      speed: player.speed
    });
  }

  readonly clip: string;
  readonly at: number;
  readonly time: number;
  readonly state: PlaybackState;
  readonly loop: boolean;
  readonly speed: PlaybackSpeed;

  constructor(
    init: PlaybackMarkSnapshot
  ) {
    this.clip = init.clip;
    this.at = init.at;
    this.time = init.time;
    this.state = init.state;
    this.loop = init.loop;
    this.speed = init.speed;
  }

  mirrorInto(
    player: AnimationPlayer
  ): void {
    if (!player.clips.some((clip) => clip.name === this.clip)) {
      return;
    }

    player.select(this.clip);
    if (player.loop !== this.loop) {
      player.loop = this.loop;
    }
    if (player.speed !== this.speed) {
      player.speed = this.speed;
    }

    switch (this.state) {
      case "stopped":
        if (player.state !== "stopped") {
          player.stop();
        }
        break;
      case "paused":
        player.pause();
        player.seek(this.time);
        break;
      case "playing":
        this.#playAlong(player);
        break;
      default: {
        const unhandled: never = this.state;
        throw new Error(`Unhandled playback state: ${String(unhandled)}`);
      }
    }
  }

  toJSON(): PlaybackMarkSnapshot {
    return {
      clip: this.clip,
      at: this.at,
      time: this.time,
      state: this.state,
      loop: this.loop,
      speed: this.speed
    };
  }

  #playAlong(
    player: AnimationPlayer
  ): void {
    const { duration } = player;
    const played = Math.max(0, Date.now() - this.at) / 1000 * this.speed;
    const time = this.loop && duration > 0 ?
      (this.time + played) % duration :
      Math.min(this.time + played, duration);

    if (player.state !== "playing") {
      player.play();
      player.seek(time);
    }
    else if (this.#drift(player.time, time, duration) > kDriftTolerance) {
      player.seek(time);
    }
  }

  #drift(
    current: number,
    expected: number,
    duration: number
  ): number {
    const distance = Math.abs(current - expected);

    return this.loop ? Math.min(distance, duration - distance) : distance;
  }
}
