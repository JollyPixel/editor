// Import Third-party Dependencies
import type * as THREE from "three";

/**
 * Minimal THREE.Texture stand-in covering the fields TilesetManager reads
 * (image dimensions) and mutates (filters/colorSpace) when registering a
 * texture, without depending on a real GPU/DOM texture.
 */
export function mockTexture(
  width = 64,
  height = 64
): THREE.Texture<HTMLImageElement> {
  return {
    magFilter: 0,
    minFilter: 0,
    colorSpace: "",
    generateMipmaps: true,
    needsUpdate: false,
    image: { width, height },
    dispose() {
      // No-op for testing
    }
  } as unknown as THREE.Texture<HTMLImageElement>;
}
