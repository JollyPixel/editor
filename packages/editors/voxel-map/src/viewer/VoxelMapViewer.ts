// Import Third-party Dependencies
import {
  voxelMapDocumentKind,
  type SyncedVoxelMap
} from "@jolly-pixel/asset.voxel-map/client";
import type {
  AssetLease,
  AssetLeases
} from "@jolly-pixel/editor.host";
import type {
  VoxelDocument,
  VoxelView
} from "@jolly-pixel/voxel.renderer";
import type { VoxelMapSource } from "@jolly-pixel/voxel.renderer/engine";

// Import Internal Dependencies
import {
  LinkedBlocksets,
  type BlocksetRecords
} from "./LinkedBlocksets.ts";
import {
  BLOCKSET_DOCUMENT_KIND,
  openBlockset
} from "./openBlockset.ts";

// CONSTANTS
export const VOXEL_MAP_DOCUMENT_KIND = voxelMapDocumentKind();

export interface VoxelMapViewerOptions {
  assets: AssetLeases;
  catalog: BlocksetRecords;
  mapId: string;
}

export class VoxelMapViewer implements VoxelMapSource {
  static readonly kinds = [
    VOXEL_MAP_DOCUMENT_KIND,
    BLOCKSET_DOCUMENT_KIND
  ] as const;

  readonly document: VoxelDocument;
  readonly ready: Promise<void>;
  readonly #lease: AssetLease<SyncedVoxelMap>;
  readonly #blocksets: LinkedBlocksets;

  constructor(
    options: VoxelMapViewerOptions
  ) {
    const { assets } = options;

    this.#lease = assets.open(VOXEL_MAP_DOCUMENT_KIND, options.mapId);
    this.document = this.#lease.document.voxels;
    this.ready = this.#lease.ready;
    this.#blocksets = new LinkedBlocksets({
      document: this.document,
      catalog: options.catalog,
      open: (assetId) => openBlockset(assets, assetId)
    });
  }

  attach(
    view: VoxelView
  ): () => void {
    return this.#blocksets.attach(view);
  }

  release(): void {
    this.#blocksets.dispose();
    this.#lease.release();
  }
}
