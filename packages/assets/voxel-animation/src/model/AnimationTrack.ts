// Import Internal Dependencies
import type {
  AnimationChannel,
  AnimationKeyJSON,
  AnimationTrackJSON
} from "../network/types.ts";
import { ANIMATION_CHANNELS } from "../network/AnimationCommand.schema.ts";
import type { TrackSample } from "./sampling/ClipSampler.ts";
import { KeyCurve } from "./sampling/KeyCurve.ts";

type ChannelCurves = Partial<Record<AnimationChannel, KeyCurve>>;

export class AnimationTrack {
  static findProblem(
    track: AnimationTrackJSON
  ): string | null {
    for (const channel of ANIMATION_CHANNELS) {
      if (!KeyCurve.isOrdered(track[channel] ?? [])) {
        return `has ${channel} keys of ${track.path} out of order`;
      }
    }

    return null;
  }

  static parse(
    track: AnimationTrackJSON
  ): AnimationTrack {
    const curves: ChannelCurves = {};
    for (const channel of ANIMATION_CHANNELS) {
      const keys = track[channel];
      if (keys !== undefined) {
        curves[channel] = new KeyCurve(keys);
      }
    }

    return new AnimationTrack(track.path, curves);
  }

  readonly path: string;
  readonly #curves: Readonly<ChannelCurves>;

  constructor(
    path: string,
    curves: Readonly<ChannelCurves> = {}
  ) {
    this.path = path;
    this.#curves = curves;
  }

  get isEmpty(): boolean {
    return ANIMATION_CHANNELS.every((channel) => this.#curves[channel] === undefined);
  }

  keyAt(
    channel: AnimationChannel,
    tick: number
  ): AnimationKeyJSON | undefined {
    return this.#curves[channel]?.at(tick);
  }

  * keys(): IterableIterator<[AnimationChannel, AnimationKeyJSON]> {
    for (const channel of ANIMATION_CHANNELS) {
      for (const key of this.#curves[channel]?.toJSON() ?? []) {
        yield [channel, key];
      }
    }
  }

  withKey(
    channel: AnimationChannel,
    key: AnimationKeyJSON
  ): AnimationTrack {
    const curve = this.#curves[channel] ?? new KeyCurve([]);

    return new AnimationTrack(this.path, {
      ...this.#curves,
      [channel]: curve.with(key)
    });
  }

  withoutKey(
    channel: AnimationChannel,
    tick: number
  ): AnimationTrack {
    const curve = this.#curves[channel];
    const next = curve?.without(tick);
    if (next === undefined || next === curve) {
      return this;
    }

    const { [channel]: _emptied, ...curves } = this.#curves;

    return new AnimationTrack(
      this.path,
      next.isEmpty ? curves : { ...curves, [channel]: next }
    );
  }

  renamed(
    path: string
  ): AnimationTrack {
    return new AnimationTrack(path, this.#curves);
  }

  sample(
    tick: number
  ): TrackSample {
    const sample: TrackSample = { path: this.path };
    for (const channel of ANIMATION_CHANNELS) {
      const value = this.#curves[channel]?.sample(tick);
      if (value !== undefined) {
        sample[channel] = value;
      }
    }

    return sample;
  }

  toJSON(): AnimationTrackJSON {
    return ANIMATION_CHANNELS.reduce<AnimationTrackJSON>((track, channel) => {
      const curve = this.#curves[channel];

      return curve === undefined ? track : { ...track, [channel]: curve.toJSON() };
    }, { path: this.path });
  }
}
