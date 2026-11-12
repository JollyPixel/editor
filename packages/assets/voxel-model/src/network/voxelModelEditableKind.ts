// Import Third-party Dependencies
import type {
  EditableDocumentKind,
  SyncedDocumentRoom
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { VOXEL_MODEL_KIND } from "../asset/voxelModel.ts";
import type { ModelDocument } from "../model/ModelDocument.ts";
import {
  voxelModelCommandProtocol,
  voxelModelCommandSchema
} from "./VoxelModelCommand.schema.ts";
import {
  voxelModelDocumentKind,
  type SyncedModelDocument
} from "./voxelModelDocumentKind.ts";
import type { VoxelModelCommand } from "./types.ts";

export type VoxelModelEditableKind = EditableDocumentKind<
  typeof VOXEL_MODEL_KIND,
  SyncedDocumentRoom<ModelDocument, AssetRoomNotice>,
  SyncedModelDocument,
  VoxelModelCommand
>;

export function voxelModelEditableKind(): VoxelModelEditableKind {
  return {
    ...voxelModelDocumentKind(),
    commandSchema: voxelModelCommandSchema,
    commandProtocol: voxelModelCommandProtocol,
    localEdits: (synced) => synced.document
  };
}
