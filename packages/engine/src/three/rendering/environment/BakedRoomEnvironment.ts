// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  RoomEnvironment
} from "three/addons/environments/RoomEnvironment.js";

// CONSTANTS
const kMapUrl = new URL("./roomEnvironment.bin", import.meta.url);
const kCubeSize = 64;
const kMipLevels = 4;
const kFaces = 6;
const kChannels = 4;
const kFaceSizes = Array.from(
  { length: kMipLevels },
  (_, level) => kCubeSize >> level
);
const kTexelCount = kFaceSizes.reduce(
  (count, size) => count + (size * size * kFaces * kChannels),
  0
);

export class BakedRoomEnvironment {
  static #loading: Promise<BakedRoomEnvironment> | null = null;

  static load(): Promise<BakedRoomEnvironment> {
    if (BakedRoomEnvironment.#loading === null) {
      BakedRoomEnvironment.#loading = Promise.resolve()
        .then(() => BakedRoomEnvironment.#request());
      BakedRoomEnvironment.#loading.catch(() => undefined);
    }

    return BakedRoomEnvironment.#loading;
  }

  static async #request(): Promise<BakedRoomEnvironment> {
    const response = await fetch(kMapUrl);
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
    if (texels.length !== kTexelCount) {
      throw new RangeError(
        `Room environment holds ${texels.length} half floats, expected ${kTexelCount}`
      );
    }

    this.#texels = texels;
  }

  createRenderTarget(
    renderer: THREE.Renderer
  ): THREE.CubeRenderTarget {
    const target = new THREE.CubeRenderTarget(kCubeSize, {
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearMipmapLinearFilter,
      generateMipmaps: false,
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.LinearSRGBColorSpace,
      depthBuffer: false
    });
    target.texture.name = "PMREM";
    target.texture.isPMREMTexture = true;
    for (const size of kFaceSizes) {
      // @ts-expect-error
      target.texture.mipmaps.push({
        width: size,
        height: size
      });
    }
    if ("isWebGPUBackend" in renderer.backend) {
      this.#upload(renderer, target);
    }
    else {
      generateRoomEnvironment(renderer, target);
    }

    return target;
  }

  #upload(
    renderer: THREE.Renderer,
    target: THREE.CubeRenderTarget
  ): void {
    renderer.initRenderTarget(target);

    let offset = 0;
    for (const [level, size] of kFaceSizes.entries()) {
      const count = size * size * kFaces * kChannels;
      const upload = new THREE.DataArrayTexture(
        this.#texels.subarray(offset, offset + count),
        size,
        size,
        kFaces
      );
      upload.format = THREE.RGBAFormat;
      upload.type = THREE.HalfFloatType;
      upload.needsUpdate = true;
      try {
        renderer.copyTextureToTexture(
          upload,
          target.texture,
          new THREE.Box3(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(size, size, kFaces)
          ),
          new THREE.Vector3(0, 0, 0),
          0,
          level
        );
      }
      finally {
        upload.dispose();
      }
      offset += count;
    }
  }
}

function generateRoomEnvironment(
  renderer: THREE.Renderer,
  target: THREE.CubeRenderTarget
): void {
  const room = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  try {
    generator.fromScene(room, 0.04, 0.1, 100, {
      renderTarget: target
    });
  }
  finally {
    generator.dispose();
    room.dispose();
  }
}
