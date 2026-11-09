// Import Third-party Dependencies
import {
  AssetReference,
  type AssetLoadContext,
  type AssetLoader,
  type AssetRecord
} from "@jolly-pixel/asset";
import type { VoxelModelFile } from "@jolly-pixel/asset.voxel-model";
import { ModelDocument } from "@jolly-pixel/asset.voxel-model/client";
import { PIXEL_ART_DOCUMENT } from "@jolly-pixel/editor.pixel-art/runtime";
import * as THREE from "three";

// Import Internal Dependencies
import { GameVoxelModel } from "./GameVoxelModel.ts";

export class VoxelModelLoader implements AssetLoader<GameVoxelModel> {
  #manager: THREE.LoadingManager;

  constructor(
    manager: THREE.LoadingManager
  ) {
    this.#manager = manager;
  }

  async load(
    record: AssetRecord,
    context: AssetLoadContext
  ): Promise<GameVoxelModel> {
    const loader = new THREE.FileLoader(this.#manager);
    const file: VoxelModelFile = JSON.parse(
      String(await loader.loadAsync(record.path.toString()))
    );
    const pixels = await context.assets.load(
      new AssetReference(file.texture.id, PIXEL_ART_DOCUMENT)
    );
    const document = new ModelDocument();
    document.load(file);

    return new GameVoxelModel(document, pixels);
  }
}
