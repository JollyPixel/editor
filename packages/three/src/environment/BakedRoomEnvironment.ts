// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// CONSTANTS
const kAtlasUrl = new URL("./roomEnvironment.bin", import.meta.url);
const kCubeSize = 64;
const kWidth = 3 * Math.max(kCubeSize, 16 * 7);
const kHeight = 4 * kCubeSize;
const kChannels = 4;

export class BakedRoomEnvironment {
  static #loading: Promise<BakedRoomEnvironment> | null = null;

  static load(): Promise<BakedRoomEnvironment> {
    if (BakedRoomEnvironment.#loading === null) {
      BakedRoomEnvironment.#loading = BakedRoomEnvironment.#request();
      BakedRoomEnvironment.#loading.catch(() => undefined);
    }

    return BakedRoomEnvironment.#loading;
  }

  static async #request(): Promise<BakedRoomEnvironment> {
    const response = await fetch(kAtlasUrl);
    if (!response.ok) {
      throw new Error(
        `Room environment request failed with status ${response.status}`
      );
    }

    return new BakedRoomEnvironment(
      new Uint16Array(await response.arrayBuffer())
    );
  }

  #texels: Uint16Array;

  constructor(
    texels: Uint16Array
  ) {
    const expected = kWidth * kHeight * kChannels;
    if (texels.length !== expected) {
      throw new RangeError(
        `Room environment holds ${texels.length} half floats, expected ${expected}`
      );
    }

    this.#texels = texels;
  }

  createRenderTarget(
    renderer: Pick<THREE.Renderer, "initRenderTarget" | "copyTextureToTexture">
  ): THREE.RenderTarget {
    const target = new THREE.RenderTarget(kWidth, kHeight, {
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      generateMipmaps: false,
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.LinearSRGBColorSpace,
      depthBuffer: false
    });
    target.texture.name = "PMREM.cubeUv";
    target.texture.mapping = THREE.CubeUVReflectionMapping;

    const upload = new THREE.DataTexture(
      this.#texels,
      kWidth,
      kHeight,
      THREE.RGBAFormat,
      THREE.HalfFloatType
    );
    upload.needsUpdate = true;
    try {
      renderer.initRenderTarget(target);
      renderer.copyTextureToTexture(upload, target.texture);
    }
    finally {
      upload.dispose();
    }

    return target;
  }
}
