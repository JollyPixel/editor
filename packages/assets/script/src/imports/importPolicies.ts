// Import Internal Dependencies
import { ScriptImportPolicy } from "./ScriptImportPolicy.ts";

// CONSTANTS
const kThreeModules = ["three", "three/webgpu", "three/tsl"];

export const SCRIPT_IMPORTS = new ScriptImportPolicy({
  modules: ["@jolly-pixel/engine", ...kThreeModules],
  relative: true
});

export const SHADER_IMPORTS = new ScriptImportPolicy({
  modules: kThreeModules,
  relative: false
});
