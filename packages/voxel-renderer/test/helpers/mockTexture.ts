// Import Third-party Dependencies
import type * as THREE from "three";

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
    dispose: () => void 0
  } as unknown as THREE.Texture<HTMLImageElement>;
}
