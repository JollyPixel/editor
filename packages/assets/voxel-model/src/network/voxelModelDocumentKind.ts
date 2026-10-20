// Import Third-party Dependencies
import {
  commandDocumentKind,
  type CommandDocumentKind,
  type SyncedCommandDocument
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { VOXEL_MODEL_KIND } from "../asset/voxelModel.ts";
import { ModelDocument } from "../model/ModelDocument.ts";
import { voxelModelWriteKeys } from "./VoxelModelCommandKeys.ts";

export type SyncedModelDocument = SyncedCommandDocument<
  ModelDocument,
  AssetRoomNotice
>;

export type VoxelModelDocumentKind = CommandDocumentKind<
  typeof VOXEL_MODEL_KIND,
  ModelDocument,
  AssetRoomNotice
>;

export function voxelModelDocumentKind(): VoxelModelDocumentKind {
  return commandDocumentKind({
    kind: VOXEL_MODEL_KIND,
    createDocument: () => new ModelDocument(),
    keys: voxelModelWriteKeys
  });
}
