// Import Third-party Dependencies
import type {
  AssetLoader,
  AssetRecord
} from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";
import type { Systems } from "@jolly-pixel/ecs";

export class EnvironmentFileAssetLoader implements AssetLoader<Systems.EnvironmentFile> {
  #manager: THREE.LoadingManager;

  constructor(
    manager: THREE.LoadingManager
  ) {
    this.#manager = manager;
  }

  async load(
    record: AssetRecord
  ): Promise<Systems.EnvironmentFile> {
    const text = await new THREE.FileLoader(this.#manager)
      .loadAsync(record.path.toString());

    const file: Systems.EnvironmentFile = JSON.parse(String(text));

    return file;
  }
}
