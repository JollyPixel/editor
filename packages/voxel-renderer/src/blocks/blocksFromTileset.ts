// Import Internal Dependencies
import type { ResolvedTilesetDefinition } from "../tileset/types.ts";
import type { ResolvedBlockDefinition } from "./BlockDefinition.ts";
import { composeBlockId } from "./BlockId.ts";

// CONSTANTS
/**
 * Historical byte-sized cap, unrelated to `MAX_LOCAL_BLOCK_ID`.
 */
const kDefaultLimit = 255;

export type BlockOverrides = Partial<
  Pick<
    ResolvedBlockDefinition,
    | "name"
    | "shapeId"
    | "collidable"
    | "alphaMode"
    | "side"
    | "alphaCutoff"
    | "materialGroup"
    | "cullCoveredFaces"
    | "properties"
  >
>;

/**
 * The tile grid blocks are generated from. With an `id`, tile references
 * name that tileset; with a `slot`, block ids are projected into it.
 */
export type TilesetGridSource =
  & Pick<ResolvedTilesetDefinition, "cols" | "rows">
  & Partial<Pick<ResolvedTilesetDefinition, "id" | "slot">>;

export interface BlocksFromTilesetOptions {
  /**
   * Maximum tileset-local block id to generate (inclusive).
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
 * One cube block per tile, row-major, with ids starting at 1.
 */
export function* blocksFromTileset(
  def: TilesetGridSource,
  options: BlocksFromTilesetOptions = {}
): IterableIterator<ResolvedBlockDefinition> {
  const {
    limit = kDefaultLimit,
    map
  } = options;

  const {
    id: tilesetId,
    slot = 0,
    cols,
    rows
  } = def;

  let blockId = 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (blockId > limit) {
        return;
      }

      yield {
        id: composeBlockId(slot, blockId),
        name: `Block ${blockId}`,
        shapeId: "cube",
        collidable: false,
        properties: {},
        faceTextures: {},
        defaultTexture: {
          ...(tilesetId === undefined ? {} : { tilesetId }),
          col,
          row
        },
        ...map?.(blockId, col, row)
      };
      blockId++;
    }
  }
}
