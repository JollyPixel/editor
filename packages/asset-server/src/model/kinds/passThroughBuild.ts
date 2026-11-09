// Import Internal Dependencies
import type { AssetBuild } from "./AssetKindHandler.ts";

// CONSTANTS
export const PASS_THROUGH_BUILD: AssetBuild = {
  version: "pass-through",
  build: (_state, content) => Promise.resolve(content)
};
