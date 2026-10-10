// Import Internal Dependencies
import { ANIMATION_CHANNELS } from "../../network/AnimationCommand.schema.ts";

export interface TrackKeys<TKey> {
  path: string;
  position?: TKey[];
  rotation?: TKey[];
  scale?: TKey[];
}

export function mapTrackKeys<TFrom, TTo>(
  track: Readonly<TrackKeys<TFrom>>,
  map: (key: TFrom) => TTo
): TrackKeys<TTo> {
  return ANIMATION_CHANNELS.reduce<TrackKeys<TTo>>((mapped, channel) => {
    const keys = track[channel];

    return keys === undefined ?
      mapped :
      {
        ...mapped,
        [channel]: keys.map((key) => map(key))
      };
  }, { path: track.path });
}
