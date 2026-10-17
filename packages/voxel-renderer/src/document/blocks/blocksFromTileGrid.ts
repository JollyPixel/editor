// Import Internal Dependencies
import type { ResolvedBlocksetDefinition } from "../blocksets/types.ts";
import type { ResolvedBlockDefinition } from "./BlockDefinition.ts";
import { composeBlockId } from "./BlockId.ts";

// CONSTANTS
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
    | "blendGroup"
    | "cullCoveredFaces"
    | "properties"
  >
>;

export type TileGridSource =
  & Pick<ResolvedBlocksetDefinition, "cols" | "rows">
  & Partial<Pick<ResolvedBlocksetDefinition, "id" | "slot">>;

export interface BlocksFromTileGridOptions {
  /**
   * Maximum blockset-local block id to generate (inclusive).
   * @default 255
   */
  limit?: number;
  map?: (
    blockId: number,
    col: number,
    row: number
  ) => BlockOverrides;
}

export function* blocksFromTileGrid(
  def: TileGridSource,
  options: BlocksFromTileGridOptions = {}
): IterableIterator<ResolvedBlockDefinition> {
  const {
    limit = kDefaultLimit,
    map
  } = options;

  const {
    id: blocksetId,
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
          ...(blocksetId === undefined ? {} : { blocksetId }),
          col,
          row
        },
        ...map?.(blockId, col, row)
      };
      blockId++;
    }
  }
}
