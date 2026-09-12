// Import Internal Dependencies
import { BlockSurface } from "../blocks/BlockSurface.ts";

// CONSTANTS
const kCutoutSuffix = ":cutout";
const kSurfaceSuffix = ":surface=";

/**
 * A chunk draw group identified by its atlas and surface policy.
 */
export class ChunkGeometryKey {
  readonly tilesetId: string;
  readonly surface: BlockSurface;

  constructor(
    tilesetId: string,
    surface: BlockSurface | boolean = false
  ) {
    if (
      tilesetId.endsWith(kCutoutSuffix) ||
      tilesetId.includes(kSurfaceSuffix)
    ) {
      throw new RangeError("Tileset id uses a reserved geometry suffix.");
    }

    this.tilesetId = tilesetId;
    this.surface = typeof surface === "boolean"
      ? new BlockSurface({ alphaMode: surface ? "blend" : "opaque" })
      : surface;
    Object.freeze(this);
  }

  get cutout(): boolean {
    return !this.surface.occludes;
  }

  static parse(
    key: string
  ): ChunkGeometryKey {
    const separator = key.lastIndexOf(kSurfaceSuffix);
    if (separator !== -1) {
      return new ChunkGeometryKey(
        key.slice(0, separator),
        new BlockSurface(
          JSON.parse(key.slice(separator + kSurfaceSuffix.length))
        )
      );
    }

    return key.endsWith(kCutoutSuffix) ?
      new ChunkGeometryKey(key.slice(0, -kCutoutSuffix.length), true) :
      new ChunkGeometryKey(key);
  }

  toString(): string {
    const { alphaMode, side } = this.surface;

    if (
      alphaMode === "opaque" &&
      side === "front"
    ) {
      return this.tilesetId;
    }
    if (
      alphaMode === "blend" &&
      side === "double"
    ) {
      return this.tilesetId + kCutoutSuffix;
    }

    return this.tilesetId + kSurfaceSuffix + JSON.stringify(this.surface);
  }

  equals(
    other: ChunkGeometryKey
  ): boolean {
    return this.toString() === other.toString();
  }
}
