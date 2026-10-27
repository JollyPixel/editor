// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import { randomId } from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import { createSceneEnvironment } from "../model/sceneEnvironment.ts";
import { SceneTransform } from "../model/SceneTransform.ts";
import type {
  JSONObject,
  SceneActorJSON,
  SceneSnapshot,
  SceneTransformJSON
} from "../network/types.ts";
import { SCENE_ICON } from "./icons.ts";

// CONSTANTS
export const SCENE_KIND = "scene";
export const SCENE_COMMAND = "scene.command";
export const SCENE_EXTENSION = ".scene.json";
export const SCENE_FILE_VERSION = 1;
const kCameraPosition = { x: 0, y: 2, z: 6 };
const kCameraPitch = -Math.atan2(kCameraPosition.y, kCameraPosition.z) * 180 / Math.PI;

export const SCENE_ASSET: AssetKindDescriptor = {
  kind: SCENE_KIND,
  label: "Scene",
  extension: SCENE_EXTENSION,
  icon: SCENE_ICON
};

export type SceneFile = SceneSnapshot & {
  version: typeof SCENE_FILE_VERSION;
};

export function createSceneFile(): SceneFile {
  return {
    version: SCENE_FILE_VERSION,
    environment: createSceneEnvironment(),
    actors: [
      seedActor("Main Camera", "Camera", { projectionMode: "perspective" }, {
        position: kCameraPosition,
        rotation: { x: kCameraPitch, y: 0, z: 0 }
      }),
      seedActor("Sun", "Light", { kind: "directional", castShadow: true }, {
        position: { x: 0, y: 10, z: 0 },
        rotation: { x: -50, y: 30, z: 0 }
      }),
      seedActor("Sky", "Light", { kind: "hemisphere" })
    ]
  };
}

function seedActor(
  name: string,
  type: string,
  data: JSONObject,
  transform: Partial<SceneTransformJSON> = {}
): SceneActorJSON {
  return {
    id: randomId(),
    name,
    parentId: null,
    visible: true,
    transform: SceneTransform.create(transform),
    components: [{
      id: randomId(),
      type,
      data,
      assets: {}
    }]
  };
}
