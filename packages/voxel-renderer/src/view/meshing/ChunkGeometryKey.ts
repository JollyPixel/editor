// Import Internal Dependencies
import type { BlockSurface } from "../../document/blocks/BlockSurface.ts";

// CONSTANTS
const kSurfaceSeparator = ":surface=";
const kBlendedSuffix = ":blended";

/**
 * A chunk draw group identified by its atlas, surface policy, material
 * group, and whether its faces carry blend neighbours.
 */
export class ChunkGeometryKey {
  readonly blocksetId: string;
  readonly surface: BlockSurface;
  readonly blended: boolean;

  constructor(
    blocksetId: string,
    surface: BlockSurface,
    blended = false
  ) {
    if (blocksetId.includes(kSurfaceSeparator)) {
      throw new RangeError("Blockset id uses a reserved geometry separator.");
    }

    this.blocksetId = blocksetId;
    this.surface = surface;
    this.blended = blended;
    Object.freeze(this);
  }

  toString(): string {
    const { alphaMode, side, materialGroup } = this.surface;
    if (
      alphaMode === "opaque" &&
      side === "front" &&
      materialGroup === undefined &&
      !this.blended
    ) {
      return this.blocksetId;
    }

    const key = this.blocksetId + kSurfaceSeparator + JSON.stringify(this.surface);

    return this.blended ? key + kBlendedSuffix : key;
  }
}
