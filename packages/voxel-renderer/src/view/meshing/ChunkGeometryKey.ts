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
  readonly tilesetId: string;
  readonly surface: BlockSurface;
  readonly blended: boolean;

  constructor(
    tilesetId: string,
    surface: BlockSurface,
    blended = false
  ) {
    if (tilesetId.includes(kSurfaceSeparator)) {
      throw new RangeError("Tileset id uses a reserved geometry separator.");
    }

    this.tilesetId = tilesetId;
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
      return this.tilesetId;
    }

    const key = this.tilesetId + kSurfaceSeparator + JSON.stringify(this.surface);

    return this.blended ? key + kBlendedSuffix : key;
  }
}
