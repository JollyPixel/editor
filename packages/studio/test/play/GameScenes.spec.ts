// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  GameScenes,
  type SceneFileSource
} from "../../src/play/GameScenes.ts";

function actor(
  id: string,
  fields: Partial<Systems.SceneActorFile>
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
    ...fields
  };
}

function sceneWithActors(
  actors: Systems.SceneActorFile[]
): Systems.SceneFile {
  return {
    version: 1,
    environment: {
      background: null,
      environment: {
        kind: "none",
        intensity: 1
      },
      fog: {
        kind: "none"
      }
    },
    actors
  };
}

function sceneFile(
  ...prefabs: { id: string; kind: string; }[]
): Systems.SceneFile {
  return sceneWithActors(
    prefabs.map((prefab, index) => actor(`actor-${index}`, { prefab }))
  );
}

function scene(
  id: string
): { id: string; kind: string; } {
  return {
    id,
    kind: "scene"
  };
}

describe("GameScenes", () => {
  test("loads the start scene and every scene its prefabs expand, once each", async() => {
    const files = new Map([
      ["arena", sceneFile(scene("house"), scene("tree"))],
      ["house", sceneFile(scene("door"), scene("arena"))],
      ["tree", sceneFile(scene("door"))],
      ["door", sceneFile({ id: "map", kind: "voxelmap" })]
    ]);
    const loaded: string[] = [];
    const source: SceneFileSource = {
      load: async(reference) => {
        loaded.push(reference.id.value);

        return files.get(reference.id.value)!;
      }
    };

    const scenes = await GameScenes.load(source, "arena");

    assert.deepStrictEqual(loaded.sort(), ["arena", "door", "house", "tree"]);
    assert.strictEqual(scenes.find("door"), files.get("door"));
    assert.strictEqual(scenes.find("map"), null);
  });

  test("finds a component that passes a check in a scene's expanded actors, prefab overrides applied", () => {
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
    function scenes(
      overrides: Systems.SceneOverridesFile["components"]
    ): GameScenes {
      return new GameScenes(new Map([
        ["arena", sceneWithActors([
          actor("island", {
            prefab: scene("terrain"),
            overrides: { components: overrides }
          })
        ])],
        ["terrain", sceneWithActors([
          actor("map", { components: [ground] }),
          actor("cliff", { prefab: scene("rock") })
        ])],
        ["rock", sceneWithActors([actor("map", { components: [ground] })])]
      ]));
    }
    const solid = {
      data: {
        collision: true
      }
    };

    assert.deepStrictEqual(
      [
        scenes({}).uses("arena", solidMap),
        scenes({}).uses("arena", (component) => component.type === "VoxelMap"),
        scenes({ ground: solid }).uses("arena", solidMap),
        scenes({ "cliff/ground": solid }).uses("arena", solidMap),
        scenes({ "cave/ground": solid }).uses("arena", solidMap),
        scenes({ ground: { assets: {} } }).uses("arena", solidMap)
      ],
      [false, true, true, true, false, false]
    );
  });

  test("rejects when a scene fails to load", async() => {
    const source: SceneFileSource = {
      load: async(reference) => {
        if (reference.id.value === "house") {
          throw new Error("house is missing");
        }

        return sceneFile(scene("house"));
      }
    };

    await assert.rejects(GameScenes.load(source, "arena"), /house is missing/);
  });
});
