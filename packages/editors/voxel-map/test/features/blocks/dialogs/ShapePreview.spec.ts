// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  resolveBlockDefinition,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { ShapePreview } from "../../../../src/features/blocks/dialogs/ShapePreview.ts";

// CONSTANTS
const kHost = {
  renders: 0,
  requestUpdate() {
    this.renders++;
  }
};

function block(): ResolvedBlockDefinition {
  return resolveBlockDefinition({
    id: 1,
    name: "Stone",
    shapeId: "cube",
    faceTextures: {},
    collidable: true
  });
}

describe("ShapePreview", () => {
  it("passes the block through until a shape is shown", () => {
    const stone = block();
    const preview = new ShapePreview(kHost);

    assert.equal(preview.apply(stone), stone);

    preview.show("cube");

    assert.equal(preview.apply(stone), stone);
  });

  it("asks the dialog for a render when a shape is shown", () => {
    const before = kHost.renders;
    new ShapePreview(kHost).show("ramp");

    assert.equal(kHost.renders, before + 1);
  });

  it("swaps the shape on one stable copy so the preview mesh is built once", () => {
    const stone = block();
    const preview = new ShapePreview(kHost);
    preview.show("ramp");

    const ramp = preview.apply(stone);

    assert.equal(ramp?.shapeId, "ramp");
    assert.equal(ramp?.name, "Stone");
    assert.equal(preview.apply(stone), ramp);
    assert.equal(stone.shapeId, "cube");

    preview.show("stair");

    assert.equal(preview.apply(stone)?.shapeId, "stair");
  });

  it("returns the block again once cleared", () => {
    const stone = block();
    const preview = new ShapePreview(kHost);
    preview.show("ramp");
    preview.clear();

    assert.equal(preview.apply(stone), stone);
  });
});
