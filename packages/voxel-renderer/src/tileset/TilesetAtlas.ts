// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  AtlasSize,
  ResolvedTilesetDefinition,
  TilesetDefinition,
  TilesetImage,
  TilesetTexture,
  TilesetUVRegion
} from "./types.ts";

/**
 * Fills in a missing tile grid, flooring partial tiles out of it.
 */
export function resolveTilesetDefinition(
  def: TilesetDefinition,
  size: AtlasSize
): ResolvedTilesetDefinition {
  return {
    ...def,
    cols: def.cols ?? Math.floor(size.width / def.tileSize),
    rows: def.rows ?? Math.floor(size.height / def.tileSize)
  };
}

export class TilesetAtlas {
  readonly def: ResolvedTilesetDefinition;
  readonly texture: TilesetTexture;

  constructor(
    def: TilesetDefinition,
    texture: TilesetTexture
  ) {
    this.def = resolveTilesetDefinition(def, texture.image);
    this.texture = texture;

    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
  }

  uvFor(
    col: number,
    row: number,
    size: number = this.def.tileSize
  ): TilesetUVRegion {
    const { cols, rows, tileSize } = this.def;
    const width = cols * tileSize;
    const height = rows * tileSize;
    const bottom = ((rows - row) * tileSize) - size;

    return {
      offsetU: ((col * tileSize) + 0.5) / width,
      offsetV: (bottom + 0.5) / height,
      scaleU: (size - 1) / width,
      scaleV: (size - 1) / height
    };
  }

  updateImage(
    image: TilesetImage
  ): void {
    this.texture.image = image;
    this.texture.needsUpdate = true;
  }
}
