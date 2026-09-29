// Import Internal Dependencies
import type { ResolvedBlockDefinition } from "./BlockDefinition.ts";
import { BlockTextures } from "./BlockTextures.ts";
import type { BlockShape } from "./shape/BlockShape.ts";
import {
  resolvedBlockTextureSlots,
  type ResolvedBlockTextureSlot
} from "./shape/shapeTextureLayout.ts";
import {
  tileFootprint,
  tileRectOf,
  UNIT_TILE_SPAN,
  type TileRect
} from "../tilesets/tileRef.ts";
import type {
  ResolvedTileRef,
  TileSpan
} from "../tilesets/types.ts";

export class BlockTextureLayout {
  static of(
    block: ResolvedBlockDefinition,
    shape: BlockShape | undefined
  ): BlockTextureLayout {
    return new BlockTextureLayout(
      block,
      shape === undefined ? [] : resolvedBlockTextureSlots(block, shape)
    );
  }

  readonly block: ResolvedBlockDefinition;
  readonly slots: readonly ResolvedBlockTextureSlot[];

  constructor(
    block: ResolvedBlockDefinition,
    slots: readonly ResolvedBlockTextureSlot[]
  ) {
    this.block = block;
    this.slots = slots;

    Object.freeze(this);
  }

  usesTileset(
    tilesetId: string
  ): boolean {
    return this.slots.some(({ tile }) => tile.tilesetId === tilesetId);
  }

  slotsIn(
    tilesetId: string
  ): ResolvedBlockTextureSlot[] {
    return this.slots.filter(({ tile }) => tile.tilesetId === tilesetId);
  }

  drawnRectsIn(
    tilesetId: string,
    tileSize: number
  ): TileRect[] {
    return uniqueRects(this.slotsIn(tilesetId).map(
      ({ tile, bounds, span }) => tileRectOf(tile, tileSize, bounds, span)
    ));
  }

  footprintsIn(
    tilesetId: string,
    tileSize: number
  ): TileRect[] {
    const spans = this.#spansByTile();
    const rects: TileRect[] = [];
    for (const ref of BlockTextures.of(this.block)) {
      if (ref.tilesetId !== tilesetId) {
        continue;
      }

      rects.push({
        x: ref.col * tileSize,
        y: ref.row * tileSize,
        ...tileFootprint(
          ref.size ?? tileSize,
          spans.get(ref) ?? UNIT_TILE_SPAN,
          ref.rotation
        )
      });
    }

    return uniqueRects(rects);
  }

  #spansByTile(): Map<ResolvedTileRef, Readonly<TileSpan>> {
    const spans = new Map<ResolvedTileRef, Readonly<TileSpan>>();
    for (const { tile, span } of this.slots) {
      const known = spans.get(tile) ?? UNIT_TILE_SPAN;
      spans.set(tile, {
        u: Math.max(known.u, span.u),
        v: Math.max(known.v, span.v)
      });
    }

    return spans;
  }
}

function uniqueRects(
  rects: Iterable<TileRect>
): TileRect[] {
  const unique = new Map<string, TileRect>();
  for (const rect of rects) {
    const key = `${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
    if (!unique.has(key)) {
      unique.set(key, rect);
    }
  }

  return [...unique.values()];
}
