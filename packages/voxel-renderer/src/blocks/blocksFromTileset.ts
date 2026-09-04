// Import Internal Dependencies
import type { ResolvedTilesetDefinition } from "../tileset/types.ts";
import type { ResolvedBlockDefinition } from "./BlockDefinition.ts";

// CONSTANTS
/**
 * Historical byte-sized cap, unrelated to `MAX_BLOCK_ID`.
 */
const kDefaultLimit = 255;

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

export function* blocksFromTileset(
  def: ResolvedTilesetDefinition,
  options: BlocksFromTilesetOptions = {}
): IterableIterator<ResolvedBlockDefinition> {
  const {
    limit = kDefaultLimit,
    map
  } = options;

  const { id: tilesetId, cols, rows } = def;

  let blockId = 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (blockId > limit) {
        return;
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
