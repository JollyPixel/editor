// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  TestStudio,
  type HostedAsset,
  type TestAssetRecord
} from "@jolly-pixel/golem.kit/testing";

// Import Internal Dependencies
import {
  sceneAssetKind,
  type SceneState
} from "#src/index.ts";
import {
  GOLEM_KINDS,
  type SceneAsset,
  type SceneComponentDeclaration
} from "#src/golem/index.ts";

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

export interface OpenedScene {
  scene: SceneAsset;
  hosted: HostedAsset<SceneState>;
}

export async function openScene(
  records: readonly TestAssetRecord[] = []
): Promise<OpenedScene> {
  const studio = new TestStudio({
    kinds: GOLEM_KINDS,
    kindPackages: [
      {
        name: "@jolly-pixel/asset.scene",
        sceneComponents: kSceneComponents
      }
    ]
  });
  for (const record of records) {
    studio.record(record);
  }
  const hosted = studio.host("scenes/level.scene.json", sceneAssetKind());

  return {
    hosted,
    scene: await studio.open(hosted.id, "scene")
  };
}

export function actorNamed(
  scene: SceneAsset,
  name: string
): string {
  const actor = [...scene.tree.actors()].find((actor) => actor.name === name);
  assert.ok(actor, `the scene has no "${name}" actor`);

  return actor.id;
}
