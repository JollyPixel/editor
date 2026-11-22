// Import Node.js Dependencies
import { mock } from "node:test";

// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import { Systems } from "@jolly-pixel/ecs";

export function createActorFile(
  id: string,
  overrides: Partial<Systems.SceneActorFile> = {}
): Systems.SceneActorFile {
  return {
    id,
    name: id,
    parentId: null,
    visible: true,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    },
    components: [],
    ...overrides
  };
}

export function createComponentFile(
  id: string,
  type: string,
  data: Systems.JSONObject = {},
  assets: Record<string, AssetReferenceData | null> = {}
): Systems.SceneComponentFile {
  return {
    id,
    type,
    data,
    assets
  };
}

export function createWarningLogger() {
  const adapter = {
    log: mock.fn(),
    warn: mock.fn(),
    error: mock.fn()
  };
  const logger = new Systems.Logger({
    level: "warn",
    namespaces: ["*"],
    adapter
  });

  return {
    logger,
    warnings: () => adapter.warn.mock.calls.map((call) => call.arguments)
  };
}

export function createComponentContext(
  mode: Systems.SceneMode
): Systems.ComponentContext {
  return {
    mode,
    assets: new Systems.ComponentAssets({}, {}, {
      resolve: () => {
        throw new Error("No asset slot expected");
      }
    })
  };
}
