// Import Third-party Dependencies
import { SyncedCommandDocument } from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { VOXEL_MODEL_KIND } from "../asset/voxelModel.ts";
import {
  ModelDocument,
  type ModelImage
} from "../model/ModelDocument.ts";
import { voxelModelWriteKeys } from "./VoxelModelCommandKeys.ts";
import type {
  VoxelModelNetworkCommand,
  VoxelModelRoom,
  VoxelModelSnapshot
} from "./types.ts";

export class SyncedModelDocument extends SyncedCommandDocument<
  ModelDocument,
  VoxelModelNetworkCommand,
  VoxelModelSnapshot,
  AssetRoomNotice,
  ModelImage
> {
  constructor(
    room: VoxelModelRoom
  ) {
    super(room, {
      document: new ModelDocument(),
      keys: voxelModelWriteKeys
    });
  }
}

export interface VoxelModelDocumentKind {
  readonly kind: typeof VOXEL_MODEL_KIND;
  createDocument(
    room: VoxelModelRoom
  ): SyncedModelDocument;
}

export function voxelModelDocumentKind(): VoxelModelDocumentKind {
  return {
    kind: VOXEL_MODEL_KIND,
    createDocument: (room) => new SyncedModelDocument(room)
  };
}
