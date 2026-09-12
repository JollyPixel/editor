// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import {
  layerPresenceKey,
  layerRefPresenceKey,
  readLayerPresenceKey
} from "../../../../src/features/layers/collaboration/layerPresenceKey.ts";

describe("layerRefPresenceKey", () => {
  it("keys a voxel layer by its name", () => {
    assert.equal(
      layerRefPresenceKey({ kind: "voxel-layer", name: "Ground" }),
      "voxel-layer:Ground"
    );
  });

  it("keys an object layer by its name", () => {
    assert.equal(
      layerRefPresenceKey({ kind: "object-layer", name: "Props" }),
      "object-layer:Props"
    );
  });

  it("keys an object by its id alone, so a reparent keeps the key", () => {
    assert.equal(
      layerRefPresenceKey({
        kind: "object",
        layerName: "Props",
        objectId: "abc"
      }),
      layerRefPresenceKey({
        kind: "object",
        layerName: "Other",
        objectId: "abc"
      })
    );
  });

  it("separates the three kinds sharing one name", () => {
    const keys = new Set([
      layerRefPresenceKey({ kind: "voxel-layer", name: "same" }),
      layerRefPresenceKey({ kind: "object-layer", name: "same" }),
      layerRefPresenceKey({
        kind: "object",
        layerName: "same",
        objectId: "same"
      })
    ]);

    assert.equal(keys.size, 3);
  });
});

describe("layerPresenceKey", () => {
  it("maps an empty selection to null", () => {
    assert.equal(layerPresenceKey(null), null);
  });

  it("maps a selection through its ref key", () => {
    assert.equal(
      layerPresenceKey({ kind: "voxel-layer", name: "Ground" }),
      "voxel-layer:Ground"
    );
  });
});

describe("readLayerPresenceKey", () => {
  it("accepts a non-empty string", () => {
    assert.equal(readLayerPresenceKey("voxel-layer:Ground"), "voxel-layer:Ground");
  });

  it("rejects anything else", () => {
    assert.equal(readLayerPresenceKey(null), null);
    assert.equal(readLayerPresenceKey(""), null);
    assert.equal(readLayerPresenceKey(3), null);
    assert.equal(readLayerPresenceKey(undefined), null);
  });
});
