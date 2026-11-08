// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { SceneComponentPackage } from "@jolly-pixel/editor.host/scene";

// Import Internal Dependencies
import { PreviewKinds } from "../../../src/preview/page/PreviewKinds.ts";

function component(
  type: string,
  slots: Record<string, string>,
  optionalAssets: string[] = []
) {
  return {
    definition: {
      type,
      assets: Object.fromEntries(
        Object.entries(slots).map(([name, kind]) => [name, { kind: { value: kind } }])
      )
    },
    label: type,
    category: "3d",
    form: () => [],
    optionalAssets
  };
}

function source(
  kind: string
) {
  return {
    descriptor: {
      kind
    },
    documentKinds: [],
    open: () => {
      throw new Error("not opened in this test");
    }
  };
}

// CONSTANTS
const kPackage = {
  components: [
    component("VoxelModel", { model: "voxelmodel" }),
    component("Model", { model: "model", shader: "shader" }, ["shader"]),
    component("Prop", { map: "voxelmap", font: "font" })
  ],
  assets: [
    source("voxelmodel"),
    source("model"),
    source("voxelmap")
  ]
} as unknown as SceneComponentPackage;

describe("PreviewKinds", () => {
  const kinds = new PreviewKinds([
    {
      name: "@jolly-pixel/editor.voxel",
      module: {
        SCENE_COMPONENTS: kPackage
      }
    }
  ]);

  test("shows a kind with the component whose one required slot takes it", () => {
    for (const [kind, type] of [["voxelmodel", "VoxelModel"], ["model", "Model"]]) {
      const preview = kinds.find(kind);

      assert.strictEqual(preview?.component.definition.type, type, kind);
      assert.strictEqual(preview?.slot, "model");
      assert.strictEqual(preview?.source.descriptor.kind, kind);
    }
  });

  test("shows no kind that lacks an asset source or a component of its own", () => {
    assert.strictEqual(kinds.find("voxelmap"), undefined);
    assert.strictEqual(kinds.find("font"), undefined);
  });
});
