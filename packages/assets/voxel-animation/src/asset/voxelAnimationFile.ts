// Import Third-party Dependencies
import type { Infer } from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  animationClipSchema,
  animationKeySchema,
  animationSetSnapshotSchema,
  animationTrackSchema
} from "../network/AnimationCommand.schema.ts";
import type {
  AnimationInterpolation,
  AnimationTrackJSON
} from "../network/types.ts";
import { mapTrackKeys } from "../model/trackKeys.ts";
import {
  VOXEL_ANIMATION_FILE_VERSION,
  type VoxelAnimationFile
} from "./voxelAnimation.ts";

// CONSTANTS
const kDefaultInterpolation: AnimationInterpolation = "linear";

const kCompactKeysSchema = z.optional(z.array(z.extend(animationKeySchema, {
  interpolation: z.optional(animationKeySchema.shape.interpolation)
})));

const kCompactTrackSchema = z.extend(animationTrackSchema, {
  position: kCompactKeysSchema,
  rotation: kCompactKeysSchema,
  scale: kCompactKeysSchema
});

export const compactVoxelAnimationFileSchema = z.object({
  version: z.literal(VOXEL_ANIMATION_FILE_VERSION),
  rig: animationSetSnapshotSchema.shape.rig,
  clips: z.array(z.extend(animationClipSchema, {
    tracks: z.array(kCompactTrackSchema)
  }))
});

export type CompactVoxelAnimationFile = Infer<
  typeof compactVoxelAnimationFileSchema
>;
type CompactAnimationTrack =
  CompactVoxelAnimationFile["clips"][number]["tracks"][number];

export function compactVoxelAnimationFile(
  file: VoxelAnimationFile
): CompactVoxelAnimationFile {
  return {
    ...file,
    clips: file.clips.map((clip) => {
      return {
        ...clip,
        tracks: clip.tracks.map(compactTrack)
      };
    })
  };
}

export function expandVoxelAnimationFile(
  compact: CompactVoxelAnimationFile
): VoxelAnimationFile {
  return {
    ...compact,
    clips: compact.clips.map((clip) => {
      return {
        ...clip,
        tracks: clip.tracks.map(expandTrack)
      };
    })
  };
}

function compactTrack(
  track: AnimationTrackJSON
): CompactAnimationTrack {
  return mapTrackKeys(track, ({ interpolation, ...key }) => (
    interpolation === kDefaultInterpolation ?
      key :
      { ...key, interpolation }
  ));
}

function expandTrack(
  compact: CompactAnimationTrack
): AnimationTrackJSON {
  return mapTrackKeys(compact, ({ interpolation = kDefaultInterpolation, ...key }) => {
    return { ...key, interpolation };
  });
}
