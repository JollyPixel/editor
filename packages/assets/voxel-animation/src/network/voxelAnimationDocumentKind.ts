// Import Third-party Dependencies
import {
  commandDocumentKind,
  type CommandDocumentKind
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { VOXEL_ANIMATION_KIND } from "../asset/voxelAnimation.ts";
import { AnimationDocument } from "../model/AnimationDocument.ts";
import { animationFootprint } from "../model/command/animationCommands.ts";

export type VoxelAnimationDocumentKind = CommandDocumentKind<
  typeof VOXEL_ANIMATION_KIND,
  AnimationDocument,
  AssetRoomNotice
>;

export function voxelAnimationDocumentKind(): VoxelAnimationDocumentKind {
  return commandDocumentKind({
    kind: VOXEL_ANIMATION_KIND,
    createDocument: () => new AnimationDocument(),
    keys: (command) => animationFootprint(command).writes?.map((ref) => ref.key) ?? null
  });
}
