// Import Third-party Dependencies
import { SyncedDocument } from "@jolly-pixel/network/client";
import {
  VoxelDocument,
  type VoxelDocumentOptions,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { VOXEL_MAP_KIND } from "../asset/voxelMap.ts";
import type { VoxelEdits } from "../history/VoxelEdits.ts";
import { VoxelSyncClient } from "./VoxelSyncClient.ts";
import type { VoxelMapRoom } from "./types.ts";

export type SyncedVoxelMapOptions = Pick<
  VoxelDocumentOptions,
  "chunkSize" | "layers" | "blocks" | "logger"
>;

export class SyncedVoxelMap extends SyncedDocument<SyncedVoxelMap> {
  readonly voxels: VoxelDocument;
  readonly edits: VoxelEdits;

  #sync: VoxelSyncClient;

  get document(): this {
    return this;
  }

  constructor(
    room: VoxelMapRoom,
    options: SyncedVoxelMapOptions = {}
  ) {
    const voxels = new VoxelDocument(options);
    const sync = new VoxelSyncClient({
      room,
      document: voxels
    });
    super(sync);
    this.voxels = voxels;
    this.edits = sync.edits;
    this.#sync = sync;
  }

  replaceWorld(
    data: VoxelWorldJSON
  ): void {
    this.#sync.replaceWorld(data);
  }
}

export interface VoxelMapDocumentKind {
  readonly kind: typeof VOXEL_MAP_KIND;
  createDocument(
    room: VoxelMapRoom
  ): SyncedVoxelMap;
}

export function voxelMapDocumentKind(
  options: SyncedVoxelMapOptions = {}
): VoxelMapDocumentKind {
  return {
    kind: VOXEL_MAP_KIND,
    createDocument: (room) => new SyncedVoxelMap(room, options)
  };
}
