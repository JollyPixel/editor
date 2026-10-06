// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { BlocksetAtlas } from "./BlocksetAtlas.ts";
import {
  MISSING_BLOCKSET_DEFINITION
} from "../../document/blocksets/missingBlockset.ts";

// CONSTANTS
const kSize = MISSING_BLOCKSET_DEFINITION.tileSize;
const kCrossHalfWidth = 1;
const kBackground = [255, 23, 68, 255];
const kCross = [255, 255, 255, 255];

export type MissingBlocksetAtlas = BlocksetAtlas<THREE.DataTexture>;

export function createMissingBlocksetAtlas(): MissingBlocksetAtlas {
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

  return new BlocksetAtlas(MISSING_BLOCKSET_DEFINITION, texture);
}
