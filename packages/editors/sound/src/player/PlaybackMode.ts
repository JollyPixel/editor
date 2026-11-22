// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/ecs";
import * as z from "zod/mini";

// Import Internal Dependencies
import { LoopRegion } from "./LoopRegion.ts";
import { PlaybackTuning } from "./PlaybackTuning.ts";
import {
  SourcePlacement,
  type SourcePlacementSnapshot
} from "./spatial/SourcePlacement.ts";
import type { Volume } from "./volume/Volume.ts";

// CONSTANTS
export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4] as const;
export const PLAYBACK_RULES = ["track", "settings", "spatial"] as const;

export type PlaybackSpeed = typeof PLAYBACK_SPEEDS[number];
export type PlaybackRules = typeof PLAYBACK_RULES[number];

export interface PlaybackModeSnapshot {
  readonly loop: boolean;
  readonly reversed: boolean;
  readonly speed: PlaybackSpeed;
  readonly rules: PlaybackRules;
  readonly pitchRoll: number;
  readonly placement: SourcePlacementSnapshot;
}

export class PlaybackMode {
  static readonly schema = z.object({
    loop: z.boolean(),
    reversed: z.boolean(),
    speed: z.literal(PLAYBACK_SPEEDS),
    rules: z.enum(PLAYBACK_RULES),
    pitchRoll: z.number().check(z.gte(-1), z.lte(1)),
    placement: SourcePlacement.schema
  });
  static readonly default = new PlaybackMode({
    loop: false,
    reversed: false,
    speed: 1,
    rules: "track",
    pitchRoll: 0,
    placement: SourcePlacement.default
  });

  readonly loop: boolean;
  readonly reversed: boolean;
  readonly speed: PlaybackSpeed;
  readonly rules: PlaybackRules;
  readonly pitchRoll: number;
  readonly placement: SourcePlacement;

  constructor(
    snapshot: PlaybackModeSnapshot
  ) {
    this.loop = snapshot.loop;
    this.reversed = snapshot.reversed;
    this.speed = snapshot.speed;
    this.rules = snapshot.rules;
    this.pitchRoll = snapshot.pitchRoll;
    this.placement = new SourcePlacement(snapshot.placement);
  }

  get applySettings(): boolean {
    return this.rules !== "track";
  }

  get spatial(): boolean {
    return this.rules === "spatial";
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

  withApplySettings(
    applySettings: boolean
  ): PlaybackMode {
    return this.#with({ rules: applySettings ? "settings" : "track" });
  }

  withSpatial(
    spatial: boolean
  ): PlaybackMode {
    return this.#with({ rules: spatial ? "spatial" : "settings" });
  }

  withPlacement(
    placement: SourcePlacement
  ): PlaybackMode {
    return this.#with({ placement: placement.toJSON() });
  }

  rerolled(): PlaybackMode {
    return this.#with({ pitchRoll: Systems.rollPitch() });
  }

  tune(
    settings: Readonly<Systems.SoundSettings>,
    duration: number
  ): PlaybackTuning {
    if (this.applySettings) {
      return new PlaybackTuning({
        duration,
        rate: Systems.variedPitch(settings, this.pitchRoll),
        reversed: false,
        loop: LoopRegion.resolve(settings, duration)
      });
    }

    return new PlaybackTuning({
      duration,
      rate: this.speed,
      reversed: this.reversed,
      loop: this.loop ? LoopRegion.whole(duration) : null
    });
  }

  level(
    settings: Readonly<Systems.SoundSettings>
  ): number {
    return this.applySettings ? settings.volume : 1;
  }

  monitorGain(
    volume: Volume
  ): number {
    return this.applySettings ? 1 : volume.gain();
  }

  toJSON(): PlaybackModeSnapshot {
    return {
      loop: this.loop,
      reversed: this.reversed,
      speed: this.speed,
      rules: this.rules,
      pitchRoll: this.pitchRoll,
      placement: this.placement.toJSON()
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
