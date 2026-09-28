// Import Internal Dependencies
import { VOXEL_MODEL_KIND } from "../asset/voxelModel.ts";
import { ModelDocument } from "../model/ModelDocument.ts";
import { ModelSyncClient } from "./ModelSyncClient.ts";
import type { VoxelModelRoom } from "./types.ts";

export class SyncedModelDocument {
  readonly document: ModelDocument;
  readonly ready: Promise<void>;

  #sync: ModelSyncClient;

  get loaded(): boolean {
    return this.#sync.ready;
  }

  constructor(
    room: VoxelModelRoom
  ) {
    this.document = new ModelDocument();
    this.#sync = new ModelSyncClient({
      room,
      document: this.document
    });
    this.ready = this.#sync.whenReady();
  }

  dispose(): void {
    this.#sync.destroy();
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
