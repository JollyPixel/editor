// Import Third-party Dependencies
import type {
  AssetLoader,
  AssetRecord
} from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { ShaderModule } from "../shader/ShaderModule.ts";

export class ShaderModuleLoader implements AssetLoader<ShaderModule> {
  #manager: THREE.LoadingManager;

  constructor(
    manager: THREE.LoadingManager
  ) {
    this.#manager = manager;
  }

  async load(
    record: AssetRecord
  ): Promise<ShaderModule> {
    const path = record.path.toString();
    const code = await new THREE.FileLoader(this.#manager).loadAsync(path);

    return ShaderModule.load(String(code), path);
  }
}
