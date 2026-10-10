// Import Third-party Dependencies
import {
  AssetType,
  type AssetLoader,
  type AssetRecord
} from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { extname } from "../utils/path.ts";

export const TEXTURE_ASSET = new AssetType<THREE.Texture>("texture");

export interface CompressedTextureLoader {
  loadAsync(
    url: string
  ): Promise<THREE.CompressedTexture>;
}

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
  /**
   * Loads `.ktx2` sources, usually a `KTX2Loader` whose transcoder path is set
   * and whose `detectSupport()` ran. Without it, `.ktx2` sources fail to load.
   */
  ktx2?: CompressedTextureLoader;
}

/**
 * Loads textures through the runtime's Three.js loading manager.
 * The default filter preserves pixel-art edges.
 */
export class TextureAssetLoader implements AssetLoader<THREE.Texture> {
  #manager: THREE.LoadingManager;
  #filter: THREE.MagnificationTextureFilter;
  #colorSpace: THREE.ColorSpace;
  #ktx2: CompressedTextureLoader | null;

  constructor(
    manager: THREE.LoadingManager,
    options: TextureAssetLoaderOptions = {}
  ) {
    this.#manager = manager;
    this.#filter = options.filter ?? THREE.NearestFilter;
    this.#colorSpace = options.colorSpace ?? THREE.SRGBColorSpace;
    this.#ktx2 = options.ktx2 ?? null;
  }

  async load(
    record: AssetRecord
  ): Promise<THREE.Texture> {
    let texture: THREE.Texture;
    try {
      texture = await this.#loadSource(record.source);
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

  #loadSource(
    source: string
  ): Promise<THREE.Texture> {
    if (extname(source).toLowerCase() !== ".ktx2") {
      return new THREE.TextureLoader(this.#manager).loadAsync(source);
    }

    if (this.#ktx2 === null) {
      throw new Error("No KTX2 loader configured");
    }

    return this.#ktx2.loadAsync(source);
  }
}
