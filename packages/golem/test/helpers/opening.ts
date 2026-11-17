// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import { DependencyIndex } from "@jolly-pixel/asset-server/client";
import type { SceneComponentDeclaration } from "@jolly-pixel/asset.scene/golem";
import type { AssetOpening } from "@jolly-pixel/golem.kit";
import type { Room } from "@jolly-pixel/network/client";

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
      editors: [
        {
          name: "scene",
          kinds: ["scene"],
          sceneComponents: kSceneComponents
        }
      ]
    },
    signal: new AbortController().signal,
    onClose: () => undefined,
    open: (assetId) => Promise.reject(new Error(`no asset ${assetId} in this test`))
  };
}
