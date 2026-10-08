// Import Third-party Dependencies
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

export class SyncedVoxelMap {
  readonly voxels: VoxelDocument;
  readonly edits: VoxelEdits;
  readonly ready: Promise<void>;

  #sync: VoxelSyncClient;

  get loaded(): boolean {
    return this.#sync.ready;
  }

  constructor(
    room: VoxelMapRoom,
    options: SyncedVoxelMapOptions = {}
  ) {
    this.voxels = new VoxelDocument(options);
    this.#sync = new VoxelSyncClient({
      room,
      document: this.voxels
    });
    this.edits = this.#sync.edits;
    this.ready = this.#sync.whenReady();
  }

  replaceWorld(
    data: VoxelWorldJSON
  ): void {
    this.#sync.replaceWorld(data);
  }

  dispose(): void {
    this.#sync.destroy();
  }
}

export interface SyncedVoxelMapLease {
  document: SyncedVoxelMap;
  ready: Promise<void>;
  dispose(): void;
}

export interface VoxelMapDocumentKind {
  readonly kind: typeof VOXEL_MAP_KIND;
  createDocument(
    room: VoxelMapRoom
  ): SyncedVoxelMapLease;
}

export function voxelMapDocumentKind(
  options: SyncedVoxelMapOptions = {}
): VoxelMapDocumentKind {
  return {
    kind: VOXEL_MAP_KIND,
    createDocument: (room) => {
      const map = new SyncedVoxelMap(room, options);

      return {
        document: map,
        ready: map.ready,
        dispose: () => map.dispose()
      };
    }
  };
}
