// Import Third-party Dependencies
import { SyncedCommandDocument } from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { VOXEL_ANIMATION_KIND } from "../asset/voxelAnimation.ts";
import {
  AnimationDocument,
  type AnimationImage
} from "../model/AnimationDocument.ts";
import { animationWriteKeys } from "./AnimationCommandKeys.ts";
import type {
  AnimationNetworkCommand,
  AnimationRoom,
  AnimationSetSnapshot
} from "./types.ts";

export class SyncedAnimationDocument extends SyncedCommandDocument<
  AnimationDocument,
  AnimationNetworkCommand,
  AnimationSetSnapshot,
  AssetRoomNotice,
  AnimationImage
> {
  constructor(
    room: AnimationRoom
  ) {
    super(room, {
      document: new AnimationDocument(),
      keys: animationWriteKeys
    });
  }
}

export interface VoxelAnimationDocumentKind {
  readonly kind: typeof VOXEL_ANIMATION_KIND;
  createDocument(
    room: AnimationRoom
  ): SyncedAnimationDocument;
}

export function voxelAnimationDocumentKind(): VoxelAnimationDocumentKind {
  return {
    kind: VOXEL_ANIMATION_KIND,
    createDocument: (room) => new SyncedAnimationDocument(room)
  };
}
