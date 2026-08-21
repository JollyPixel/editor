// Import Third-party Dependencies
import {
  AssetType,
  type AssetLoader,
  type AssetRecord
} from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";

export const TEXTURE_ASSET = new AssetType<THREE.Texture>("texture");

export interface TextureAssetLoaderOptions {
  /**
   * Magnification and minification filter applied to every loaded texture.
   * Nearest keeps pixel-art edges crisp.
   * @default THREE.NearestFilter
   */
  filter?: THREE.MagnificationTextureFilter;
  /**
   * @default THREE.SRGBColorSpace
   */
  colorSpace?: THREE.ColorSpace;
}

/**
 * Loads textures through the runtime's Three.js loading manager.
 * The default filter preserves pixel-art edges.
 */
export class TextureAssetLoader implements AssetLoader<THREE.Texture> {
  #manager: THREE.LoadingManager;
  #filter: THREE.MagnificationTextureFilter;
  #colorSpace: THREE.ColorSpace;

  constructor(
    manager: THREE.LoadingManager,
    options: TextureAssetLoaderOptions = {}
  ) {
    this.#manager = manager;
    this.#filter = options.filter ?? THREE.NearestFilter;
    this.#colorSpace = options.colorSpace ?? THREE.SRGBColorSpace;
  }

  async load(
    record: AssetRecord
  ): Promise<THREE.Texture> {
    let texture: THREE.Texture;
    try {
      texture = await new THREE.TextureLoader(this.#manager)
        .loadAsync(record.source);
    }
    catch (error: unknown) {
      throw new Error(
        `Failed to load texture: ${record.source}`,
        { cause: error }
      );
    }

    texture.colorSpace = this.#colorSpace;
    texture.magFilter = this.#filter;
    texture.minFilter = this.#filter;

    return texture;
  }
}
