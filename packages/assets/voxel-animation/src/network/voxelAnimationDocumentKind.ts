// Import Third-party Dependencies
import {
  commandDocumentKind,
  type CommandDocumentKind,
  type SyncedCommandDocument
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { VOXEL_ANIMATION_KIND } from "../asset/voxelAnimation.ts";
import { AnimationDocument } from "../model/AnimationDocument.ts";
import { animationWriteKeys } from "./AnimationCommandKeys.ts";

export type SyncedAnimationDocument = SyncedCommandDocument<
  AnimationDocument,
  AssetRoomNotice
>;

export type VoxelAnimationDocumentKind = CommandDocumentKind<
  typeof VOXEL_ANIMATION_KIND,
  AnimationDocument,
  AssetRoomNotice
>;

export function voxelAnimationDocumentKind(): VoxelAnimationDocumentKind {
  return commandDocumentKind({
    kind: VOXEL_ANIMATION_KIND,
    createDocument: () => new AnimationDocument(),
    keys: animationWriteKeys
  });
}
