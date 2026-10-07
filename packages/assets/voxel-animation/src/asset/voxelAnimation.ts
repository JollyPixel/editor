// Import Third-party Dependencies
import {
  defineSchema,
  describeErrors,
  SchemaParser,
  type Infer
} from "@jolly-pixel/network";
import {
  InvalidAssetDocumentError,
  type AssetKindDescriptor
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { animationSetSnapshotSchema } from "../network/AnimationCommand.schema.ts";
import type { AnimationClipJSON } from "../network/types.ts";
import { VOXEL_ANIMATION_ICON } from "./icons.ts";

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

export const voxelAnimationDocumentSchema = defineSchema({
  type: "object",
  properties: {
    version: { const: VOXEL_ANIMATION_DOCUMENT_VERSION },
    rig: animationSetSnapshotSchema.properties.rig,
    clips: animationSetSnapshotSchema.properties.clips
  },
  required: ["version", "rig", "clips"]
});

export type VoxelAnimationDocument = Infer<typeof voxelAnimationDocumentSchema>;

export interface VoxelAnimationDocumentOptions {
  rig?: string;
  clips?: AnimationClipJSON[];
}

const kDocumentParser = new SchemaParser(voxelAnimationDocumentSchema);

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
  return new TextEncoder().encode(JSON.stringify(document));
}

export function decodeVoxelAnimationDocument(
  content: Uint8Array
): VoxelAnimationDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(content));
  }
  catch (error) {
    throw new InvalidAssetDocumentError(
      VOXEL_ANIMATION_KIND,
      "content is not JSON",
      { cause: error }
    );
  }

  const result = kDocumentParser.parse(parsed);
  if (result.err) {
    throw new InvalidAssetDocumentError(
      VOXEL_ANIMATION_KIND,
      describeErrors(result.val)
    );
  }

  return result.val;
}
