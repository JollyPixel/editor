// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { CompressedTextureLoader } from "./TextureAssetLoader.ts";

export interface DisposableCompressedTextureLoader
  extends CompressedTextureLoader {
  dispose(): void;
}

export class LazyCompressedTextureLoader implements CompressedTextureLoader {
  #create: () => Promise<DisposableCompressedTextureLoader>;
  #loader: Promise<DisposableCompressedTextureLoader> | null = null;

  static ktx2(
    manager: THREE.LoadingManager,
    transcoderPath: string,
    renderer: THREE.WebGPURenderer
  ): LazyCompressedTextureLoader {
    return new LazyCompressedTextureLoader(async() => {
      const { KTX2Loader } = await import(
        "three/addons/loaders/KTX2Loader.js"
      );

      return new KTX2Loader(manager)
        .setTranscoderPath(transcoderPath)
        .detectSupport(renderer);
    });
  }

  constructor(
    create: () => Promise<DisposableCompressedTextureLoader>
  ) {
    this.#create = create;
  }

  async loadAsync(
    url: string
  ): Promise<THREE.CompressedTexture> {
    this.#loader ??= this.#create();
    const loader = await this.#loader;

    return loader.loadAsync(url);
  }

  dispose(): void {
    void this.#loader?.then(
      (loader) => loader.dispose(),
      () => undefined
    );
  }
}
