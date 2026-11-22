// Import Third-party Dependencies
import {
  SCRIPT_MODULE_ASSET,
  ScriptDefinition
} from "@jolly-pixel/ecs";
import {
  SCRIPT_ASSET_TYPES,
  ShaderAssetType,
  type ThreeComponentPackage
} from "@jolly-pixel/backend.three";
import {
  ScriptModuleLoader,
  ShaderModuleLoader
} from "@jolly-pixel/scripting/three";

// CONSTANTS
export const SCRIPT_DEFINITION = new ScriptDefinition({}, {
  assetTypes: SCRIPT_ASSET_TYPES
});

export const RUNTIME_COMPONENTS: ThreeComponentPackage = {
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
