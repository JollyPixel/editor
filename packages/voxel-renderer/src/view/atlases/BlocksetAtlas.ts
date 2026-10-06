// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  AtlasSize,
  ResolvedBlocksetDefinition,
  BlocksetDefinition,
  AtlasNormalTexture,
  AtlasTexture,
  AtlasUVRegion,
  TileRotation,
  TileSpan
} from "../../document/blocksets/types.ts";
import {
  tileFootprint,
  UNIT_TILE_SPAN
} from "../../document/blocksets/tileRef.ts";

/**
 * Fills in a missing tile grid, flooring partial tiles out of it. Throws
 * when the definition declares no tile size.
 */
export function resolveBlocksetDefinition(
  def: BlocksetDefinition,
  size: AtlasSize
): ResolvedBlocksetDefinition {
  const { tileSize } = def;
  if (tileSize === undefined) {
    throw new Error(
      `Blockset '${def.id}' declares no tile size; load its asset first.`
    );
  }

  return {
    ...def,
    tileSize,
    cols: def.cols ?? Math.floor(size.width / tileSize),
    rows: def.rows ?? Math.floor(size.height / tileSize)
  };
}

// eslint-disable-next-line max-params
export function tileUvRegion(
  def: ResolvedBlocksetDefinition,
  col: number,
  row: number,
  size: number = def.tileSize,
  span: Readonly<TileSpan> = UNIT_TILE_SPAN,
  rotation: TileRotation = 0
): AtlasUVRegion {
  const { cols, rows, tileSize } = def;
  const width = cols * tileSize;
  const height = rows * tileSize;
  const footprint = tileFootprint(size, span, rotation);
  const bottom = ((rows - row) * tileSize) - footprint.height;

  return {
    offsetU: ((col * tileSize) + 0.5) / width,
    offsetV: (bottom + 0.5) / height,
    scaleU: (footprint.width - 1) / width,
    scaleV: (footprint.height - 1) / height
  };
}

export class BlocksetAtlas<
  TTexture extends THREE.Texture<AtlasSize> = AtlasTexture
> {
  readonly def: ResolvedBlocksetDefinition;
  readonly texture: TTexture;
  readonly normal: AtlasNormalTexture | null;

  constructor(
    def: BlocksetDefinition,
    texture: TTexture,
    normal: AtlasNormalTexture | null = null
  ) {
    this.def = resolveBlocksetDefinition(def, texture.image);
    this.texture = texture;
    this.normal = normal;

    configureTexture(texture, THREE.SRGBColorSpace);
    if (normal !== null) {
      configureTexture(normal, THREE.NoColorSpace);
    }
  }

  uvFor(
    col: number,
    row: number,
    size?: number,
    span?: Readonly<TileSpan>,
    rotation?: TileRotation
  ): AtlasUVRegion {
    return tileUvRegion(this.def, col, row, size, span, rotation);
  }

  updateImage(
    image: TTexture["image"]
  ): void {
    this.texture.image = image;
    this.texture.needsUpdate = true;
  }

  updateNormal(
    image: AtlasSize
  ): void {
    if (this.normal === null) {
      throw new Error(
        `BlocksetAtlas: blockset "${this.def.id}" has no normal texture.`
      );
    }

    this.normal.image = image;
    this.normal.needsUpdate = true;
  }

  disposeReplacedBy(
    next: BlocksetAtlas<TTexture>
  ): void {
    const kept = next.#textures();
    for (const texture of this.#textures()) {
      if (!kept.includes(texture)) {
        texture.dispose();
      }
    }
  }

  dispose(): void {
    for (const texture of this.#textures()) {
      texture.dispose();
    }
  }

  #textures(): THREE.Texture<AtlasSize>[] {
    return this.normal === null ? [this.texture] : [this.texture, this.normal];
  }
}

function configureTexture(
  texture: THREE.Texture<AtlasSize>,
  colorSpace: THREE.ColorSpace
): void {
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = colorSpace;
  texture.generateMipmaps = false;
}
