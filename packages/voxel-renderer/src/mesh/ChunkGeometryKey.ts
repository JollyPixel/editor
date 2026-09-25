// Import Internal Dependencies
import type { BlockSurface } from "../blocks/BlockSurface.ts";

// CONSTANTS
const kSurfaceSeparator = ":surface=";

/**
 * A chunk draw group identified by its atlas, surface policy, and material
 * group.
 */
export class ChunkGeometryKey {
  readonly tilesetId: string;
  readonly surface: BlockSurface;

  constructor(
    tilesetId: string,
    surface: BlockSurface
  ) {
    if (tilesetId.includes(kSurfaceSeparator)) {
      throw new RangeError("Tileset id uses a reserved geometry separator.");
    }

    this.tilesetId = tilesetId;
    this.surface = surface;
    Object.freeze(this);
  }

  toString(): string {
    const { alphaMode, side, materialGroup } = this.surface;
    if (
      alphaMode === "opaque" &&
      side === "front" &&
      materialGroup === undefined
    ) {
      return this.tilesetId;
    }

    return this.tilesetId + kSurfaceSeparator + JSON.stringify(this.surface);
  }
}
