// Import Third-party Dependencies
import {
  AssetType,
  type AssetLoader,
  type AssetRecord
} from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";
import {
  FontLoader,
  type Font
} from "three/examples/jsm/loaders/FontLoader.js";

export const FontAssetType = new AssetType<Font>("font");

/**
 * Loads font records with the Three.js font loader used by TextRenderer.
 */
export class FontAssetLoader implements AssetLoader<Font> {
  #manager: THREE.LoadingManager;

  constructor(
    manager: THREE.LoadingManager
  ) {
    this.#manager = manager;
  }

  load(
    record: AssetRecord
  ): Promise<Font> {
    return new FontLoader(this.#manager)
      .loadAsync(record.source);
  }
}

export type { Font };
