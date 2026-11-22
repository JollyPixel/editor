// Import Third-party Dependencies
import type {
  AssetLoader,
  AssetRecord
} from "@jolly-pixel/asset";
import type { ScriptModule } from "@jolly-pixel/ecs";
import type { LoadingManager } from "three/webgpu";

// Import Internal Dependencies
import { importModule } from "../modules/linkModule.ts";

export class ScriptModuleLoader implements AssetLoader<ScriptModule> {
  #manager: LoadingManager;

  constructor(
    manager: LoadingManager
  ) {
    this.#manager = manager;
  }

  load(
    record: AssetRecord
  ): Promise<ScriptModule> {
    return importModule(this.#manager.resolveURL(record.path.toString()));
  }
}
