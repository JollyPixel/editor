// Import Third-party Dependencies
import {
  AssetType,
  type AssetLoader,
  type AssetRecord
} from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { SceneFile } from "../../core/systems/scene/file/SceneFile.ts";

export const SceneFileAssetType = new AssetType<SceneFile>("scene");

export class SceneFileAssetLoader implements AssetLoader<SceneFile> {
  #manager: THREE.LoadingManager;

  constructor(
    manager: THREE.LoadingManager
  ) {
    this.#manager = manager;
  }

  async load(
    record: AssetRecord
  ): Promise<SceneFile> {
    const text = await new THREE.FileLoader(this.#manager)
      .loadAsync(record.path.toString());

    const file: SceneFile = JSON.parse(String(text));

    return file;
  }
}
