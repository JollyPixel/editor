// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import { DependencyIndex } from "@jolly-pixel/asset-server/client";
import type { Room } from "@jolly-pixel/network/client";
import {
  SceneComponentTypes,
  type SceneComponentDeclaration
} from "@jolly-pixel/server";

// Import Internal Dependencies
import type { AssetOpening } from "#src/assets/GolemAsset.ts";

// CONSTANTS
const kSceneComponents: readonly SceneComponentDeclaration[] = [
  {
    type: "Light",
    assets: {}
  },
  {
    type: "Model",
    assets: {
      model: "model"
    }
  }
];

export function mockOpening(
  room: Room,
  records: readonly AssetRecordData[] = []
): AssetOpening {
  return {
    assetId: "asset-1",
    room,
    catalog: {
      record: (id) => records.find((record) => record.id === id),
      records: () => records.values(),
      dependencies: new DependencyIndex()
    },
    manifest: {
      sceneComponents: () => new SceneComponentTypes(kSceneComponents)
    },
    signal: new AbortController().signal,
    onClose: () => undefined,
    open: (assetId) => Promise.reject(new Error(`no asset ${assetId} in this test`))
  };
}
