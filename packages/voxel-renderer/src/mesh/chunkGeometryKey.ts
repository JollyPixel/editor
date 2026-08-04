// CONSTANTS
const kCutoutSuffix = ":cutout";

export interface ChunkGeometryKey {
  tilesetId: string;
  /**
   * True for the geometry holding the faces of `transparent` blocks. They are
   * split out of the solid geometry so they can be drawn with their own
   * material — same texture and alpha test, but double-sided.
   */
  cutout: boolean;
}

/**
 * Key one chunk geometry is stored under. A tileset id containing the
 * `":cutout"` suffix would collide with a cutout key; ids are authored, so
 * this is a naming rule rather than a runtime check.
 */
export function chunkGeometryKey(
  tilesetId: string,
  cutout: boolean
): string {
  return cutout ? tilesetId + kCutoutSuffix : tilesetId;
}

export function parseChunkGeometryKey(
  key: string
): ChunkGeometryKey {
  return key.endsWith(kCutoutSuffix) ?
    { tilesetId: key.slice(0, -kCutoutSuffix.length), cutout: true } :
    { tilesetId: key, cutout: false };
}
