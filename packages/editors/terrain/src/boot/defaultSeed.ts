// Import Third-party Dependencies
import type { AssetSeedMap } from "@jolly-pixel/asset-server";
import { TERRAIN_KIND } from "@jolly-pixel/asset.terrain";

export interface DefaultSeed {
  seed: AssetSeedMap;
}

export function createDefaultSeed(): DefaultSeed {
  return {
    seed: {
      "world.terrain.json": {
        id: crypto.randomUUID(),
        kind: TERRAIN_KIND
      }
    }
  };
}
