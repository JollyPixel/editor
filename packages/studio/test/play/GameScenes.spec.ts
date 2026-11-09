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

function sceneFile(
  ...prefabs: { id: string; kind: string; }[]
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
    actors: prefabs.map((prefab, index) => {
      return {
        id: `actor-${index}`,
        name: `Actor ${index}`,
        parentId: null,
        visible: true,
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        },
        components: [],
        prefab
      };
    })
  };
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
