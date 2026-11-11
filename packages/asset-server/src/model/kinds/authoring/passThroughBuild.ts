// Import Internal Dependencies
import type { AssetBuild } from "../AssetKindHandler.ts";

// CONSTANTS
export const PASS_THROUGH_BUILD: AssetBuild = {
  build: (_state, content) => Promise.resolve(content)
};
