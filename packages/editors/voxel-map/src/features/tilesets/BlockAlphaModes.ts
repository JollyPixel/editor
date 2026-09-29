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
import type {
  PixelDocument,
  SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { findBlocksReferencingTileset } from "./blockTextureTiles.ts";

export interface TilesetPixels {
  readonly tileSize: number;
  readonly pixels: Pick<PixelDocument, "hasTransparency">;
}

export interface BlockAlphaModesOptions {
  view: VoxelView;
  pixelsOf: (tilesetId: string) => TilesetPixels | undefined;
}

export function alphaModeFor(
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
  readonly #pixelsOf: (tilesetId: string) => TilesetPixels | undefined;

  constructor(
    options: BlockAlphaModesOptions
  ) {
    this.#view = options.view;
    this.#pixelsOf = options.pixelsOf;
  }

  resolve(
    block: BlockDefinition,
    defaultTilesetId: string | null = null
  ): ResolvedBlockDefinition {
    const resolved = resolveBlockDefinition(block);
    const transparent = this.#transparent(
      BlockTextures.of(resolved)
        .withTileset(defaultTilesetId)
        .applyTo(resolved)
    );
    if (transparent === null) {
      return resolved;
    }

    const alphaMode = alphaModeFor(resolved.alphaMode, transparent);

    return alphaMode === (resolved.alphaMode ?? "opaque") ?
      resolved :
      {
        ...resolved,
        alphaMode
      };
  }

  staleIn(
    tilesetId: string,
    bounds?: SelectionRect
  ): ResolvedBlockDefinition[] {
    const source = this.#pixelsOf(tilesetId);
    if (source === undefined) {
      return [];
    }

    const { shapes, document } = this.#view;
    const affected = findBlocksReferencingTileset(
      document.blocks.getAll(),
      (shapeId) => shapes.get(shapeId),
      tilesetId,
      source.tileSize
    );

    return affected.flatMap(({ block, rects }) => {
      if (bounds && !rects.some((rect) => rectsIntersect(rect, bounds))) {
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
    const tilesetIds = new Set(
      BlockTextureLayout.of(block, shape).slots.flatMap(
        ({ tile }) => (tile.tilesetId === undefined ? [] : [tile.tilesetId])
      )
    );
    if (tilesetIds.size === 0) {
      return null;
    }

    let known = true;
    for (const tilesetId of tilesetIds) {
      const source = this.#pixelsOf(tilesetId);
      if (source === undefined) {
        known = false;
        continue;
      }

      const [entry] = findBlocksReferencingTileset(
        [block],
        () => shape,
        tilesetId,
        source.tileSize
      );
      if (entry?.geometries.some((geometry) => source.pixels.hasTransparency(geometry))) {
        return true;
      }
    }

    return known ? false : null;
  }
}

function rectsIntersect(
  a: SelectionRect,
  b: SelectionRect
): boolean {
  return a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height;
}
