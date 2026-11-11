// Import Third-party Dependencies
import {
  SCRIPT_MODULE_ASSET,
  ScriptDefinition,
  ShaderAssetType
} from "@jolly-pixel/engine";
import type { RuntimeComponentPackage } from "@jolly-pixel/runtime";
import {
  ScriptModuleLoader,
  ShaderModuleLoader
} from "@jolly-pixel/scripting/three";

// CONSTANTS
export const SCRIPT_DEFINITION = new ScriptDefinition();

export const RUNTIME_COMPONENTS: RuntimeComponentPackage = {
  definitions: [SCRIPT_DEFINITION],
  loaders: [
    {
      type: SCRIPT_MODULE_ASSET,
      create: (manager) => new ScriptModuleLoader(manager)
    },
    {
      type: ShaderAssetType,
      create: (manager) => new ShaderModuleLoader(manager)
    }
  ]
};
