// Import Third-party Dependencies
import type {
  AssetLoader,
  AssetRecord
} from "@jolly-pixel/asset";
import {
  parsePixelArtFile,
  type PixelDocument
} from "@jolly-pixel/pixel-draw.renderer";
import * as THREE from "three";

// Import Internal Dependencies
import { pixelArtDocument } from "./pixelArtDocument.ts";

export class PixelArtDocumentLoader implements AssetLoader<PixelDocument> {
  #manager: THREE.LoadingManager;

  constructor(
    manager: THREE.LoadingManager
  ) {
    this.#manager = manager;
  }

  async load(
    record: AssetRecord
  ): Promise<PixelDocument> {
    const loader = new THREE.FileLoader(this.#manager);
    const text = await loader.loadAsync(
      record.path.toString()
    );

    return pixelArtDocument(
      parsePixelArtFile(JSON.parse(String(text)))
    );
  }
}
