// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { InvalidAssetFileError } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  COMPONENT_DATA_MAX_LENGTH,
  SCENE_FILE,
  sceneAssetKind,
  SceneState
} from "#src/index.ts";
import {
  actor,
  component,
  sceneFile
} from "../helpers/scene.ts";

// CONSTANTS
const kMap = { id: "map-1", kind: "voxelmap" };
const kTexture = { id: "texture-1", kind: "pixelart" };

function encodeJSON(
  value: unknown
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function loadInto(
  content: Uint8Array
): SceneState {
  const state = new SceneState();
  sceneAssetKind().load(state, content);

  return state;
}

describe("scene kind load", () => {
  const cases: [string, Uint8Array][] = [
    ["content that is not JSON", new TextEncoder().encode("{")],
    ["an unknown file version", encodeJSON({ ...sceneFile([]), version: 2 })],
    ["an actor listed before its parent", encodeJSON(sceneFile([
      actor("child", { parentId: "parent" }),
      actor("parent")
    ]))],
    ["an actor id listed twice", encodeJSON(sceneFile([actor("A"), actor("A")]))],
    ["a component id listed twice", encodeJSON(sceneFile([
      actor("A", { components: [component("c")] }),
      actor("B", { components: [component("c")] })
    ]))],
    ["a prefab instance", encodeJSON(sceneFile([actor("A", { prefab: kMap })]))],
    ["component data over the size limit", encodeJSON(sceneFile([
      actor("A", {
        components: [component("c", { text: "x".repeat(COMPONENT_DATA_MAX_LENGTH) })]
      })
    ]))]
  ];

  for (const [name, content] of cases) {
    test(`refuses ${name} as an invalid asset file`, () => {
      assert.throws(() => loadInto(content), InvalidAssetFileError);
    });
  }

  test("keeps the data of a component type it does not know", async() => {
    const unknown = {
      id: "c",
      type: "Particles",
      data: { rate: 4, curve: [1, { at: null }] },
      assets: { sprite: kTexture }
    };
    const file = sceneFile([actor("A", { components: [unknown] })]);
    const state = loadInto(encodeJSON(file));

    const serialized = await sceneAssetKind().serialize(state);

    assert.deepEqual(SCENE_FILE.decode(serialized), file);
  });
});

describe("scene kind assets", () => {
  function referencingState(): SceneState {
    return loadInto(encodeJSON(sceneFile([
      actor("A", {
        components: [
          component("c1", {}, { map: kMap, normal: null }),
          component("c2", {}, { map: kMap, texture: kTexture })
        ]
      })
    ])));
  }

  test("lists each filled asset slot reference once as a dependency", () => {
    assert.deepEqual(
      sceneAssetKind().dependencies?.(referencingState()),
      [kMap, kTexture]
    );
  });

  test("rebinds referenced asset ids", () => {
    const state = referencingState();
    sceneAssetKind().rebind?.(state, new Map([["map-1", "map-2"]]));

    assert.deepEqual(state.dependencies(), [
      { id: "map-2", kind: "voxelmap" },
      kTexture
    ]);
  });
});

describe("scene kind create", () => {
  test("starts a new scene from the seed", async() => {
    const handler = sceneAssetKind();
    const state = handler.create("scene-1");

    const decoded = SCENE_FILE.decode(await handler.serialize(state));

    assert.deepEqual(decoded.actors.map(({ name }) => name), ["Main Camera", "Sun", "Sky"]);
  });
});
