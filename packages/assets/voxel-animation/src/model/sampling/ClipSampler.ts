// Import Internal Dependencies
import type {
  AnimationChannel,
  AnimationClipJSON,
  Vector3JSON
} from "../../network/types.ts";
import { ANIMATION_CHANNELS } from "../../network/AnimationCommand.schema.ts";
import { KeyCurve } from "./KeyCurve.ts";

export interface AnimationSample {
  /**
   * Added to the rest position.
   */
  position?: Vector3JSON;
  /**
   * In degrees, added per axis to the rest rotation.
   */
  rotation?: Vector3JSON;
  /**
   * Multiplies the rest scale.
   */
  scale?: Vector3JSON;
}

type TrackCurves = Partial<Record<AnimationChannel, KeyCurve>>;

export class ClipSampler {
  readonly length: number;
  readonly loop: boolean;
  readonly #tracks = new Map<string, TrackCurves>();

  constructor(
    clip: Pick<AnimationClipJSON, "tracks" | "length" | "loop">
  ) {
    this.length = clip.length;
    this.loop = clip.loop;
    for (const track of clip.tracks) {
      const curves: TrackCurves = {};
      for (const channel of ANIMATION_CHANNELS) {
        const keys = track[channel] ?? [];
        if (keys.length > 0) {
          curves[channel] = new KeyCurve(keys);
        }
      }
      this.#tracks.set(track.path, curves);
    }
  }

  tickAt(
    elapsed: number
  ): number {
    return this.loop ?
      ((elapsed % this.length) + this.length) % this.length :
      Math.min(Math.max(elapsed, 0), this.length);
  }

  sample(
    tick: number
  ): Map<string, AnimationSample> {
    const samples = new Map<string, AnimationSample>();
    for (const [path, curves] of this.#tracks) {
      const sample: AnimationSample = {};
      for (const channel of ANIMATION_CHANNELS) {
        const value = curves[channel]?.sample(tick);
        if (value !== undefined) {
          sample[channel] = value;
        }
      }
      samples.set(path, sample);
    }

    return samples;
  }
}
