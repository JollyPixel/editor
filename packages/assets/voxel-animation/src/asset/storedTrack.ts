// Import Third-party Dependencies
import type { Infer } from "@jolly-pixel/network";

// Import Internal Dependencies
import { mapTrackKeys } from "../model/values/trackKeys.ts";
import type {
  AnimationInterpolation,
  AnimationTrackJSON
} from "../network/types.ts";
import type { voxelAnimationDocumentSchema } from "./voxelAnimation.ts";

// CONSTANTS
const kDefaultInterpolation: AnimationInterpolation = "linear";

type StoredAnimationDocument = Infer<typeof voxelAnimationDocumentSchema>;
type StoredAnimationTrack = StoredAnimationDocument["clips"][number]["tracks"][number];

export function compactTrack(
  track: AnimationTrackJSON
): StoredAnimationTrack {
  return mapTrackKeys(track, ({ interpolation, ...key }) => (
    interpolation === kDefaultInterpolation ?
      key :
      { ...key, interpolation }
  ));
}

export function expandTrack(
  stored: StoredAnimationTrack
): AnimationTrackJSON {
  return mapTrackKeys(stored, ({ interpolation = kDefaultInterpolation, ...key }) => {
    return { ...key, interpolation };
  });
}
