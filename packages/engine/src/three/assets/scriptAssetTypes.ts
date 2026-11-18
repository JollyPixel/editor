// Import Internal Dependencies
import type { ScriptAssetTypes } from "../../core/components/script/ScriptDefinition.ts";
import { SoundAssetType } from "./sound.ts";

// CONSTANTS
export const SCRIPT_ASSET_TYPES: Readonly<ScriptAssetTypes> = Object.freeze({
  Sound: SoundAssetType
});
