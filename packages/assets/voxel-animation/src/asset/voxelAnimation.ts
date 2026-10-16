// Import Third-party Dependencies
import {
  defineSchema,
  type Infer
} from "@jolly-pixel/network";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  animationClipSchema,
  animationKeySchema,
  animationSetSnapshotSchema,
  animationTrackSchema
} from "../network/AnimationCommand.schema.ts";
import type {
  AnimationClipJSON,
  AnimationSetSnapshot
} from "../network/types.ts";
import { VOXEL_ANIMATION_ICON } from "./icons.ts";
import { compactTrack } from "./storedTrack.ts";

// CONSTANTS
export const VOXEL_ANIMATION_KIND = "voxelanimation";
export const VOXEL_ANIMATION_COMMAND = "voxelanimation.command";
export const VOXEL_ANIMATION_EXTENSION = ".voxelanim.json";
export const VOXEL_ANIMATION_DOCUMENT_VERSION = 1;

export const VOXEL_ANIMATION_ASSET: AssetKindDescriptor = {
  kind: VOXEL_ANIMATION_KIND,
  label: "Animation set",
  extension: VOXEL_ANIMATION_EXTENSION,
  icon: VOXEL_ANIMATION_ICON
};

const kStoredKeysSchema = defineSchema({
  type: "array",
  items: {
    ...animationKeySchema,
    required: ["tick", "value"]
  }
});

const kStoredTrackSchema = defineSchema({
  ...animationTrackSchema,
  properties: {
    ...animationTrackSchema.properties,
    position: kStoredKeysSchema,
    rotation: kStoredKeysSchema,
    scale: kStoredKeysSchema
  }
});

export const voxelAnimationDocumentSchema = defineSchema({
  type: "object",
  properties: {
    version: { const: VOXEL_ANIMATION_DOCUMENT_VERSION },
    rig: animationSetSnapshotSchema.properties.rig,
    clips: {
      type: "array",
      items: {
        ...animationClipSchema,
        properties: {
          ...animationClipSchema.properties,
          tracks: { type: "array", items: kStoredTrackSchema }
        }
      }
    }
  },
  required: ["version", "rig", "clips"]
});

type StoredAnimationDocument = Infer<typeof voxelAnimationDocumentSchema>;

export type VoxelAnimationDocument = AnimationSetSnapshot & {
  version: typeof VOXEL_ANIMATION_DOCUMENT_VERSION;
};

export interface VoxelAnimationDocumentOptions {
  rig?: string;
  clips?: AnimationClipJSON[];
}

export function createVoxelAnimationDocument(
  options: VoxelAnimationDocumentOptions = {}
): VoxelAnimationDocument {
  const {
    rig = "",
    clips = []
  } = options;

  return {
    version: VOXEL_ANIMATION_DOCUMENT_VERSION,
    rig,
    clips: structuredClone(clips)
  };
}

export function encodeVoxelAnimationDocument(
  document: VoxelAnimationDocument
): Uint8Array {
  const stored: StoredAnimationDocument = {
    ...document,
    clips: document.clips.map((clip) => {
      return {
        ...clip,
        tracks: clip.tracks.map(compactTrack)
      };
    })
  };

  return new TextEncoder().encode(JSON.stringify(stored));
}
