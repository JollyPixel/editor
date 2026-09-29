// Import Third-party Dependencies
import {
  BlockPieces,
  type BlockShapeRegistry,
  type MaterialGroupList,
  type TilesetAtlases,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { TileOpacityProbe } from "./tileOpacity.ts";

export interface BlockRenderSourcesOptions {
  shapes: BlockShapeRegistry;
  atlases: TilesetAtlases;
  materialGroups?: MaterialGroupList;
  tileOpacity?: TileOpacityProbe;
}

export class BlockRenderSources {
  static of(
    view: VoxelView
  ): BlockRenderSources {
    return new BlockRenderSources({
      shapes: view.shapes,
      atlases: view.atlases,
      materialGroups: view.document.materialGroups
    });
  }

  readonly shapes: BlockShapeRegistry;
  readonly atlases: TilesetAtlases;
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
