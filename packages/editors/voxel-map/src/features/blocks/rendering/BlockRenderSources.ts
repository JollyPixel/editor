// Import Third-party Dependencies
import {
  BlockPieces,
  type BlockShapeRegistry,
  type MaterialGroupList,
  type BlocksetAtlases,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { TileOpacityProbe } from "./tileOpacity.ts";

export interface BlockRenderSourcesOptions {
  shapes: BlockShapeRegistry;
  atlases: BlocksetAtlases;
  materialGroups?: MaterialGroupList;
  tileOpacity?: TileOpacityProbe;
}

export class BlockRenderSources {
  static fromView(
    view: VoxelView
  ): BlockRenderSources {
    return new BlockRenderSources({
      shapes: view.shapes,
      atlases: view.atlases,
      materialGroups: view.document.materialGroups
    });
  }

  readonly shapes: BlockShapeRegistry;
  readonly atlases: BlocksetAtlases;
  readonly materialGroups: MaterialGroupList | undefined;
  readonly tileOpacity: TileOpacityProbe;

  constructor(
    options: BlockRenderSourcesOptions
  ) {
    this.shapes = options.shapes;
    this.atlases = options.atlases;
    this.materialGroups = options.materialGroups;
    this.tileOpacity = options.tileOpacity ??
      new TileOpacityProbe(options.atlases);
  }

  createPieces(): BlockPieces {
    return new BlockPieces({
      shapes: this.shapes,
      atlases: this.atlases,
      emptyTile: (ref, alphaCutoff) => this.tileOpacity.isEmpty(ref, alphaCutoff)
    });
  }
}
