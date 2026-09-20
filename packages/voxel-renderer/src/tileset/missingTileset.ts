// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { TilesetAtlas } from "./TilesetAtlas.ts";

// CONSTANTS
export const MISSING_TILESET_ID = "$missing";
const kSize = 16;
const kCrossHalfWidth = 1;
const kBackground = [255, 23, 68, 255];
const kCross = [255, 255, 255, 255];

export type MissingTilesetAtlas = TilesetAtlas<THREE.DataTexture>;

export function createMissingTilesetAtlas(): MissingTilesetAtlas {
  const data = new Uint8Array(kSize * kSize * 4);
  for (let y = 0; y < kSize; y++) {
    for (let x = 0; x < kSize; x++) {
      const onCross =
        Math.abs(x - y) <= kCrossHalfWidth ||
        Math.abs(x - (kSize - 1 - y)) <= kCrossHalfWidth;
      data.set(onCross ? kCross : kBackground, ((y * kSize) + x) * 4);
    }
  }

  const texture = new THREE.DataTexture(data, kSize, kSize);
  texture.needsUpdate = true;

  return new TilesetAtlas(
    {
      id: MISSING_TILESET_ID,
      tileSize: kSize,
      cols: 1,
      rows: 1
    },
    texture
  );
}
