// Import Internal Dependencies
import type { ResolvedTilesetDefinition } from "../tileset/types.ts";
import type { ResolvedBlockDefinition } from "./BlockDefinition.ts";

export type BlockOverrides = Partial<
  Pick<
    ResolvedBlockDefinition,
    "name" | "shapeId" | "collidable" | "transparent"
  >
>;

export interface BlocksFromTilesetOptions {
  /**
   * Maximum block ID to generate (inclusive).
   * @default 255
   */
  limit?: number;
  map?: (
    blockId: number,
    col: number,
    row: number
  ) => BlockOverrides;
}

/**
 * One cube block per tile, numbered from 1 in row-major order.
 */
export function* blocksFromTileset(
  def: ResolvedTilesetDefinition,
  options: BlocksFromTilesetOptions = {}
): IterableIterator<ResolvedBlockDefinition> {
  const {
    limit = 255,
    map
  } = options;

  const { id: tilesetId, cols, rows } = def;

  let blockId = 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (blockId > limit) {
        break;
      }

      yield {
        id: blockId,
        name: `Block ${blockId}`,
        shapeId: "cube",
        collidable: false,
        faceTextures: {},
        defaultTexture: {
          tilesetId,
          col,
          row
        },
        ...map?.(blockId, col, row)
      };
      blockId++;
    }
  }
}
