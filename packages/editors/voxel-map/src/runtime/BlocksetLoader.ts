// Import Third-party Dependencies
import type {
  AssetLoader,
  AssetRecord
} from "@jolly-pixel/asset";
import type { BlocksetFile } from "@jolly-pixel/asset.voxel-map/client";
import { pixelArtDocument } from "@jolly-pixel/editor.pixel-art/runtime";
import { parsePixelArtFile } from "@jolly-pixel/pixel-draw.renderer";
import { BlocksetDocument } from "@jolly-pixel/voxel.renderer";
import * as THREE from "three";

// Import Internal Dependencies
import type { GameBlockset } from "./GameBlockset.ts";

export class BlocksetLoader implements AssetLoader<GameBlockset> {
  #manager: THREE.LoadingManager;

  constructor(
    manager: THREE.LoadingManager
  ) {
    this.#manager = manager;
  }

  async load(
    record: AssetRecord
  ): Promise<GameBlockset> {
    const loader = new THREE.FileLoader(this.#manager);
    const file: BlocksetFile = JSON.parse(
      String(await loader.loadAsync(record.path.toString()))
    );

    return {
      pixels: pixelArtDocument(parsePixelArtFile(file.pixels)),
      blockset: new BlocksetDocument({
        tileSize: file.tileSize,
        blocks: file.blocks,
        materialGroups: file.materialGroups
      })
    };
  }
}
