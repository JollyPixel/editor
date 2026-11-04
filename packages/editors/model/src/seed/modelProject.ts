// Import Third-party Dependencies
import type { AssetSeedMap } from "@jolly-pixel/asset-server";
import { MODEL_KIND } from "@jolly-pixel/asset.model";

// Import Internal Dependencies
import { cubeModelGlb } from "./cubeModel.ts";

export interface ModelProject {
  seed: AssetSeedMap;
}

export function createModelProject(): ModelProject {
  return {
    seed: {
      "models/cube.glb": {
        id: crypto.randomUUID(),
        kind: MODEL_KIND,
        content: cubeModelGlb
      }
    }
  };
}
