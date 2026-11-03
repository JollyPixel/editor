// Import Third-party Dependencies
import type { AssetSeedMap } from "@jolly-pixel/asset-server";
import {
  SCRIPT_KIND,
  SCRIPT_TEMPLATE
} from "@jolly-pixel/asset.script";

export interface ScriptProject {
  seed: AssetSeedMap;
}

export function createScriptProject(): ScriptProject {
  return {
    seed: {
      "scripts/PlayerBehavior.ts": {
        id: crypto.randomUUID(),
        kind: SCRIPT_KIND,
        content: () => Promise.resolve(
          new TextEncoder().encode(
            SCRIPT_TEMPLATE.replace("NewBehavior", "PlayerBehavior")
          )
        )
      }
    }
  };
}
