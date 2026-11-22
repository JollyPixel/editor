// Import Third-party Dependencies
import type { ScriptAssetTypes } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { SoundAssetType } from "./sound.ts";

// CONSTANTS
export const SCRIPT_ASSET_TYPES: Readonly<ScriptAssetTypes> = Object.freeze({
  Sound: SoundAssetType
});
