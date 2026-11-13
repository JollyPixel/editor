// Import Internal Dependencies
import { ANIMATION_CHANNELS } from "../network/AnimationCommand.schema.ts";
import type { AnimationChannel } from "../network/types.ts";

export type TrackKeys<TKey> = { path: string; } & Partial<Record<AnimationChannel, TKey[]>>;

export function mapTrackKeys<TFrom, TTo>(
  track: Readonly<TrackKeys<TFrom>>,
  map: (key: TFrom) => TTo
): TrackKeys<TTo> {
  const mapped: TrackKeys<TTo> = { path: track.path };
  for (const channel of ANIMATION_CHANNELS) {
    const keys = track[channel];
    if (keys !== undefined) {
      mapped[channel] = keys.map((key) => map(key));
    }
  }

  return mapped;
}
