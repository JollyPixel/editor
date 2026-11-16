// Import Third-party Dependencies
import type { AssetSeedMap } from "@jolly-pixel/asset-server";
import {
  createEnvironmentFile,
  ENVIRONMENT_KIND
} from "@jolly-pixel/asset.environment";

export interface EnvironmentProject {
  seed: AssetSeedMap;
}

export function createEnvironmentProject(): EnvironmentProject {
  return {
    seed: {
      "environments/default.environment.json": {
        id: crypto.randomUUID(),
        kind: ENVIRONMENT_KIND,
        content: () => new TextEncoder().encode(JSON.stringify(createEnvironmentFile()))
      }
    }
  };
}
