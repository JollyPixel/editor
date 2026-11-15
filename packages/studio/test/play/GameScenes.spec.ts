// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { GameScenes } from "../../src/play/GameScenes.ts";
import {
  SceneFiles,
  actor,
  sceneFile,
  scenePrefab,
  sceneWithActors
} from "../helpers/sceneFiles.ts";

describe("GameScenes", () => {
  test("loads a scene and every scene its prefabs expand, once each", async() => {
    const files = new SceneFiles([
      ["arena", sceneFile(scenePrefab("house"), scenePrefab("tree"))],
      ["house", sceneFile(scenePrefab("door"), scenePrefab("arena"))],
      ["tree", sceneFile(scenePrefab("door"))],
      ["door", sceneFile({ id: "map", kind: "voxelmap" })]
    ]);
    const scenes = new GameScenes(files);

    await scenes.load("arena");

    assert.deepStrictEqual(files.loaded.sort(), ["arena", "door", "house", "tree"]);
    assert.notStrictEqual(scenes.find("door"), null);
    assert.strictEqual(scenes.find("map"), null);
  });

  test("finds a component that passes a check in expanded actors, overrides applied", async() => {
    function solidMap(
      component: Readonly<Systems.SceneComponentFile>
    ): boolean {
      return component.type === "VoxelMap" && component.data.collision === true;
    }
    const ground: Systems.SceneComponentFile = {
      id: "ground",
      type: "VoxelMap",
      data: {
        collision: false
      },
      assets: {}
    };
    async function scenes(
      overrides: Systems.SceneOverridesFile["components"]
    ): Promise<GameScenes> {
      const loaded = new GameScenes(new SceneFiles([
        ["arena", sceneWithActors([
          actor("island", {
            prefab: scenePrefab("terrain"),
            overrides: { components: overrides }
          })
        ])],
        ["terrain", sceneWithActors([
          actor("map", { components: [ground] }),
          actor("cliff", { prefab: scenePrefab("rock") })
        ])],
        ["rock", sceneWithActors([actor("map", { components: [ground] })])]
      ]));
      await loaded.load("arena");

      return loaded;
    }
    const solid = {
      data: {
        collision: true
      }
    };

    assert.deepStrictEqual(
      [
        (await scenes({})).uses("arena", solidMap),
        (await scenes({})).uses("arena", (component) => component.type === "VoxelMap"),
        (await scenes({ ground: solid })).uses("arena", solidMap),
        (await scenes({ "cliff/ground": solid })).uses("arena", solidMap),
        (await scenes({ "cave/ground": solid })).uses("arena", solidMap),
        (await scenes({ ground: { assets: {} } })).uses("arena", solidMap)
      ],
      [false, true, true, true, false, false]
    );
  });

  test("rejects when a scene fails to load", async() => {
    const scenes = new GameScenes(new SceneFiles([
      ["arena", sceneFile(scenePrefab("house"))]
    ]));

    await assert.rejects(scenes.load("arena"), /house is missing/);
  });
});
