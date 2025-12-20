// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { TiledMapTileset } from "./types.ts";

// CONSTANTS
const kFlippedAntiDiagonal = 0x20000000;
const kFlippedVertical = 0x40000000;
const kFlippedHorizontal = 0x80000000;
const kTiledFlippedFlags =
  kFlippedHorizontal |
  kFlippedVertical |
  kFlippedAntiDiagonal;

export interface TileProps {
  coords: THREE.Vector2Like;
  uv: {
    size: THREE.Vector2Like;
    offset: THREE.Vector2Like;
  };
  flippedX: boolean;
  flippedY: boolean;
  flippedAD: boolean;
}

export class TileSet {
  static find(
    tilesets: TileSet[],
    tileId: number
  ): TileSet | null {
    return tilesets
      .sort((a, b) => a.firstgid - b.firstgid)
      .find((tileSet) => tileSet.containsGid(tileId)) ?? null;
  }

  #metadata: TiledMapTileset;
  #texture: THREE.Texture<HTMLImageElement>;

  constructor(
    tiledset: TiledMapTileset,
    texture: THREE.Texture<HTMLImageElement>
  ) {
    this.#metadata = tiledset;
    this.#texture = texture;
  }

  get firstgid() {
    return this.#metadata.firstgid;
  }

  get lastgid() {
    return this.#metadata.firstgid + this.#metadata.tilecount - 1;
  }

  get tilewidth() {
    return this.#metadata.tilewidth;
  }

  get tileheight() {
    return this.#metadata.tileheight;
  }

  containsGid(
    gid: number
  ): boolean {
    return this.containsLocalId(this.getTileLocalId(gid));
  }

  containsLocalId(
    index: number
  ) {
    return index >= 0 && index < this.#metadata.tilecount;
  }

  getTileLocalId(
    gid: number
  ) {
    return (gid & ~kTiledFlippedFlags) - this.#metadata.firstgid;
  }

  getTileProperties(
    gid: number
  ): TileProps | null {
    const localId = this.getTileLocalId(gid);
    if (!this.containsLocalId(localId)) {
      return null;
    }

    const coords = {
      x: localId % this.#metadata.columns,
      y: Math.floor(localId / this.#metadata.columns)
    };

    const uvX = (coords.x * this.tilewidth) / this.#texture.image.width;
    const uvY = 1.0 - (((coords.y + 1) * this.tileheight) / this.#texture.image.height);

    return {
      coords,
      uv: {
        size: {
          x: this.tilewidth / this.#texture.image.width,
          y: this.tileheight / this.#texture.image.height
        },
        offset: {
          x: uvX,
          y: uvY
        }
      },
      flippedX: (gid & kFlippedHorizontal) !== 0,
      flippedY: (gid & kFlippedVertical) !== 0,
      flippedAD: (gid & kFlippedAntiDiagonal) !== 0
    };
  }

  getTileTexture(
    gid: number
  ): THREE.Texture | null {
    const properties = this.getTileProperties(gid);
    if (!properties) {
      return null;
    }

    const texture = this.#texture.clone();
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    applyTextureTransformations(texture, properties);

    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;

    return texture;
  }
}

function applyTextureTransformations(
  texture: THREE.Texture,
  tileProperties: TileProps
) {
  let { x: offsetX, y: offsetY } = tileProperties.uv.offset;
  let { x: repeatX, y: repeatY } = tileProperties.uv.size;

  // Gère le flip horizontal
  if (tileProperties.flippedX) {
    repeatX = -repeatX;
    offsetX += tileProperties.uv.size.x;
  }

  // Gère le flip vertical
  if (tileProperties.flippedY) {
    repeatY = -repeatY;
    offsetY += tileProperties.uv.size.y;
  }

  // Gère le flip anti-diagonal (rotation 90° + flip horizontal)
  if (tileProperties.flippedAD) {
    // Pour l'anti-diagonal, on doit échanger les axes et ajuster
    const tempRepeat = repeatX;
    repeatX = repeatY;
    repeatY = tempRepeat;

    const tempOffset = offsetX;
    offsetX = offsetY;
    offsetY = tempOffset;

    // Ajustement supplémentaire pour l'anti-diagonal
    offsetX += tileProperties.uv.size.y;
  }

  texture.offset.set(offsetX, offsetY);
  texture.repeat.set(repeatX, repeatY);
}
