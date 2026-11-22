// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetKindMismatchError,
  AssetRecord
} from "@jolly-pixel/asset";
import { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { PlayerScenes } from "../../src/play/PlayerScenes.ts";
import {
  SceneFiles,
  actor,
  sceneFile,
  scenePrefab,
  sceneWithActors
} from "../helpers/sceneFiles.ts";

// CONSTANTS
const kCatalog = new AssetCatalog([
  new AssetRecord({
    id: "menu-id",
    kind: "scene",
    path: "menu.scene.json"
  }),
  new AssetRecord({
    id: "arena-id",
    kind: "scene",
    path: "levels/arena.scene.json"
  }),
  new AssetRecord({
    id: "harbor-id",
    kind: "scene",
    path: "levels/harbor.scene.json"
  }),
  new AssetRecord({
    id: "body-id",
    kind: "scene",
    path: "prefabs/body.scene.json"
  }),
  new AssetRecord({
    id: "map-id",
    kind: "voxelmap",
    path: "levels/arena.voxelmap.json"
  })
]);
const kArena = sceneFile(scenePrefab("body-id"));
const kBody = sceneWithActors([
  actor("crate", {
    components: [
      {
        id: "body",
        type: "RigidBody",
        data: {},
        assets: {}
      }
    ]
  })
]);

function playerScenes(
  attach: () => Promise<void> = async() => undefined
): {
  scenes: PlayerScenes;
  attached: () => number;
} {
  let attached = 0;
  const scenes = new PlayerScenes({
    files: new SceneFiles([
      ["menu-id", sceneFile()],
      ["arena-id", kArena],
      ["harbor-id", sceneFile(scenePrefab("body-id"))],
      ["body-id", kBody]
    ]),
    catalog: kCatalog,
    components: new Systems.ComponentDefinitions(),
    physics: {
      uses: (component) => component.type === "RigidBody",
      attach: () => {
        attached++;

        return attach();
      }
    }
  });

  return {
    scenes,
    attached: () => attached
  };
}

describe("PlayerScenes", () => {
  test("finds a scene by asset ID, by project path, or by path without its extension", async() => {
    const { scenes } = playerScenes();

    const found = ["arena-id", "levels/arena.scene.json", "levels/arena"].map(
      (ref) => scenes.scene(ref)
    );
    await Promise.all(found.map((scene) => scene.prepare()));

    assert.deepStrictEqual(
      found.map((scene) => [scene.name, scene.file === kArena]),
      [["arena", true], ["arena", true], ["arena", true]]
    );
  });

  test("throws on a ref that names no scene of the game", () => {
    const { scenes } = playerScenes();

    assert.throws(() => scenes.scene("map-id"), AssetKindMismatchError);
    assert.throws(
      () => scenes.scene("levels/arena.voxelmap.json"),
      /No scene "levels\/arena.voxelmap.json"/
    );
    assert.throws(() => scenes.scene("levels/cave"), /No scene "levels\/cave"/);
  });

  test("attaches physics once, before the first scene whose prefabs use it", async() => {
    const { scenes, attached } = playerScenes();

    await scenes.scene("menu-id").prepare();
    const beforeArena = attached();
    await scenes.scene("arena-id").prepare();
    await scenes.scene("harbor-id").prepare();

    assert.deepStrictEqual([beforeArena, attached()], [0, 1]);
  });

  test("attaches physics again at the next scene that uses it after a failed attach", async() => {
    const failure = new Error("physics backend failed to load");
    let fail = true;
    const { scenes, attached } = playerScenes(async() => {
      if (fail) {
        fail = false;
        throw failure;
      }
    });

    await assert.rejects(async() => scenes.scene("arena-id").prepare(), failure);
    await scenes.scene("harbor-id").prepare();

    assert.strictEqual(attached(), 2);
  });
});
