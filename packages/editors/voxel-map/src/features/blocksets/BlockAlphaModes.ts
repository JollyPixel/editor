// Import Third-party Dependencies
import {
  BlockTextureLayout,
  BlockTextures,
  resolveBlockDefinition,
  type BlockAlphaMode,
  type BlockDefinition,
  type ResolvedBlockDefinition,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";
import {
  RectArea,
  type PixelDocument,
  type SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { findBlocksReferencingBlockset } from "./blockTextureTiles.ts";

export interface BlocksetPixels {
  readonly tileSize: number;
  readonly pixels: Pick<PixelDocument, "hasTransparency">;
}

export interface BlockAlphaModesOptions {
  view: VoxelView;
  resolvePixels: (
    blocksetId: string
  ) => BlocksetPixels | undefined;
}

function alphaModeFor(
  current: BlockAlphaMode | undefined,
  transparent: boolean
): BlockAlphaMode {
  if (current === "blend") {
    return "blend";
  }

  return transparent ? "mask" : "opaque";
}

export class BlockAlphaModes {
  readonly #view: VoxelView;
  readonly #resolvePixels: (
    blocksetId: string
  ) => BlocksetPixels | undefined;

  constructor(
    options: BlockAlphaModesOptions
  ) {
    this.#view = options.view;
    this.#resolvePixels = options.resolvePixels;
  }

  resolve(
    block: BlockDefinition,
    defaultBlocksetId: string | null = null
  ): ResolvedBlockDefinition {
    const resolved = resolveBlockDefinition(block);
    const transparent = this.#transparent(
      BlockTextures.fromBlock(resolved)
        .withDefaultBlockset(defaultBlocksetId)
        .createTexturedBlock(resolved)
    );
    if (transparent === null) {
      return resolved;
    }

    const alphaMode = alphaModeFor(
      resolved.alphaMode,
      transparent
    );

    return alphaMode === (resolved.alphaMode ?? "opaque") ?
      resolved :
      {
        ...resolved,
        alphaMode
      };
  }

  staleIn(
    blocksetId: string,
    bounds?: SelectionRect
  ): ResolvedBlockDefinition[] {
    const source = this.#resolvePixels(blocksetId);
    if (source === undefined) {
      return [];
    }

    const { shapes, document } = this.#view;
    const affected = findBlocksReferencingBlockset(
      document.blocks.getAll(),
      (shapeId) => shapes.get(shapeId),
      blocksetId,
      source.tileSize
    );

    const area = bounds === undefined ? null : RectArea.from(bounds);

    return affected.flatMap(({ block, rects }) => {
      if (area && !rects.some((rect) => area.intersects(rect))) {
        return [];
      }
      const resolved = this.resolve(block);

      return resolved.alphaMode === block.alphaMode ? [] : [resolved];
    });
  }

  #transparent(
    block: ResolvedBlockDefinition
  ): boolean | null {
    const shape = this.#view.shapes.get(block.shapeId);
    const blocksetIds = new Set(
      BlockTextureLayout.fromShape(block, shape).slots.flatMap(
        ({ tile }) => (tile.blocksetId === undefined ? [] : [tile.blocksetId])
      )
    );
    if (blocksetIds.size === 0) {
      return null;
    }

    let known = true;
    for (const blocksetId of blocksetIds) {
      const source = this.#resolvePixels(blocksetId);
      if (source === undefined) {
        known = false;
        continue;
      }

      const [entry] = findBlocksReferencingBlockset(
        [block],
        () => shape,
        blocksetId,
        source.tileSize
      );

      const hasSomeTransparency = entry?.geometries.some(
        (geometry) => source.pixels.hasTransparency(geometry)
      );
      if (hasSomeTransparency) {
        return true;
      }
    }

    return known ? false : null;
  }
}
