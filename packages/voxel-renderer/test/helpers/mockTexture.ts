// Import Third-party Dependencies
import * as THREE from "three";

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

export function readableTexture(
  width = 64,
  height = 64,
  data = new Uint8Array(width * height * 4)
): THREE.Texture<HTMLImageElement> {
  const image = {
    width,
    height,
    data
  } as unknown as HTMLImageElement;

  return new THREE.Texture(image);
}
