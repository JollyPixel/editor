// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  layerKey,
  objectKey,
  parseLayerKey,
  type LayerRef
} from "../../src/state/layerRef.ts";

describe("layerKey", () => {
  const refs: LayerRef[] = [
    {
      kind: "voxel-layer",
      name: "Ground"
    },
    {
      kind: "object-layer",
      name: "Triggers"
    },
    {
      kind: "object",
      layerName: "Triggers/Inside",
      objectId: "spawn"
    }
  ];

  test("round-trips every kind", () => {
    for (const ref of refs) {
      assert.deepStrictEqual(parseLayerKey(layerKey(ref)), ref);
    }
  });

  test("keeps the three kinds apart when they share a name", () => {
    const keys = new Set([
      layerKey({ kind: "voxel-layer", name: "same" }),
      layerKey({ kind: "object-layer", name: "same" }),
      objectKey({ layerName: "same", objectId: "same" })
    ]);

    assert.equal(keys.size, 3);
  });

  test("keys an object by its layer and id", () => {
    assert.equal(
      objectKey({ layerName: "zone:north", objectId: "obj-1" }),
      "obj:zone:north/obj-1"
    );
  });
});
