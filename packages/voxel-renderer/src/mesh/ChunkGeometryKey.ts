// CONSTANTS
const kCutoutSuffix = ":cutout";

/**
 * Draw group of a chunk: one tileset, with transparent faces split out so they
 * can take a double-sided material.
 */
export class ChunkGeometryKey {
  static parse(
    key: string
  ): ChunkGeometryKey {
    return key.endsWith(kCutoutSuffix) ?
      new ChunkGeometryKey(key.slice(0, -kCutoutSuffix.length), true) :
      new ChunkGeometryKey(key, false);
  }

  readonly tilesetId: string;
  readonly cutout: boolean;

  constructor(
    tilesetId: string,
    cutout = false
  ) {
    if (tilesetId.endsWith(kCutoutSuffix)) {
      throw new RangeError(
        `Tileset id "${tilesetId}" must not end in "${kCutoutSuffix}", ` +
        "since its solid group would alias a cutout one."
      );
    }

    this.tilesetId = tilesetId;
    this.cutout = cutout;

    Object.freeze(this);
  }

  toString(): string {
    return this.cutout ? this.tilesetId + kCutoutSuffix : this.tilesetId;
  }

  equals(
    other: ChunkGeometryKey
  ): boolean {
    return this.tilesetId === other.tilesetId &&
      this.cutout === other.cutout;
  }
}
