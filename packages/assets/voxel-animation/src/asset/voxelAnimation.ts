// Import Third-party Dependencies
import type { Infer } from "@jolly-pixel/network";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  animationClipSchema,
  animationKeySchema,
  animationSetSnapshotSchema,
  animationTrackSchema
} from "../network/AnimationCommand.schema.ts";
import type {
  AnimationClipJSON,
  AnimationInterpolation,
  AnimationSetSnapshot,
  AnimationTrackJSON
} from "../network/types.ts";
import { mapTrackKeys } from "../model/values/trackKeys.ts";
import { VOXEL_ANIMATION_ICON } from "./icons.ts";

// CONSTANTS
export const VOXEL_ANIMATION_KIND = "voxelanimation";
export const VOXEL_ANIMATION_COMMAND = "voxelanimation.command";
export const VOXEL_ANIMATION_EXTENSION = ".voxelanim.json";
export const VOXEL_ANIMATION_FILE_VERSION = 1;
const kDefaultInterpolation: AnimationInterpolation = "linear";

export const VOXEL_ANIMATION_ASSET: AssetKindDescriptor = {
  kind: VOXEL_ANIMATION_KIND,
  label: "Animation set",
  extension: VOXEL_ANIMATION_EXTENSION,
  icon: VOXEL_ANIMATION_ICON
};

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

export type VoxelAnimationFile = AnimationSetSnapshot & {
  version: typeof VOXEL_ANIMATION_FILE_VERSION;
};

export interface VoxelAnimationFileOptions {
  rig?: string;
  clips?: AnimationClipJSON[];
}

export function createVoxelAnimationFile(
  options: VoxelAnimationFileOptions = {}
): VoxelAnimationFile {
  const {
    rig = "",
    clips = []
  } = options;

  return {
    version: VOXEL_ANIMATION_FILE_VERSION,
    rig,
    clips: structuredClone(clips)
  };
}

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
