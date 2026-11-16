// Import Third-party Dependencies
import type {
  AssetLoader,
  AssetRecord
} from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { EnvironmentFile } from "../../core/systems/environment/EnvironmentFile.ts";

export class EnvironmentFileAssetLoader implements AssetLoader<EnvironmentFile> {
  #manager: THREE.LoadingManager;

  constructor(
    manager: THREE.LoadingManager
  ) {
    this.#manager = manager;
  }

  async load(
    record: AssetRecord
  ): Promise<EnvironmentFile> {
    const text = await new THREE.FileLoader(this.#manager)
      .loadAsync(record.path.toString());

    const file: EnvironmentFile = JSON.parse(String(text));

    return file;
  }
}
