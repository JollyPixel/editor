// Import Third-party Dependencies
import {
  AssetType,
  type AssetLoader,
  type AssetRecord
} from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";
import type { Systems } from "@jolly-pixel/ecs";

export const SceneFileAssetType = new AssetType<Systems.SceneFile>("scene");

export class JSONFileAssetLoader<T> implements AssetLoader<T> {
  #manager: THREE.LoadingManager;

  constructor(
    manager: THREE.LoadingManager
  ) {
    this.#manager = manager;
  }

  async load(
    record: AssetRecord
  ): Promise<T> {
    const text = await new THREE.FileLoader(this.#manager)
      .loadAsync(record.path.toString());

    return JSON.parse(String(text));
  }
}
