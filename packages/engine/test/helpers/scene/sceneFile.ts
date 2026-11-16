// Import Node.js Dependencies
import { mock } from "node:test";

// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { Logger } from "../../../src/core/systems/Logger.ts";
import {
  ComponentAssets,
  type ComponentContext,
  type SceneMode
} from "../../../src/core/systems/scene/file/definitions/ComponentDefinition.ts";
import type {
  JSONObject,
  SceneActorFile,
  EnvironmentReferenceData,
  SceneComponentFile,
  SceneFile
} from "../../../src/core/systems/scene/file/SceneFile.ts";

export function createActorFile(
  id: string,
  overrides: Partial<SceneActorFile> = {}
): SceneActorFile {
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
  data: JSONObject = {},
  assets: Record<string, AssetReferenceData | null> = {}
): SceneComponentFile {
  return {
    id,
    type,
    data,
    assets
  };
}

export function createSceneFile(
  actors: SceneActorFile[],
  environment: EnvironmentReferenceData | null = null
): SceneFile {
  return {
    version: 1,
    environment,
    actors
  };
}

export function createWarningLogger() {
  const adapter = {
    log: mock.fn(),
    warn: mock.fn(),
    error: mock.fn()
  };
  const logger = new Logger({
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
  mode: SceneMode
): ComponentContext {
  return {
    mode,
    assets: new ComponentAssets({}, {}, {
      resolve: () => {
        throw new Error("No asset slot expected");
      }
    })
  };
}
