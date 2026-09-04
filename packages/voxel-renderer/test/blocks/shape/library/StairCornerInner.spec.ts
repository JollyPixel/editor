// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { FACE } from "../../../../src/utils/math.ts";
import {
  StairCornerInner
} from "../../../../src/blocks/shape/library/StairCornerInner.ts";
import {
  checkNormalMagnitudes,
  checkVertexCounts
} from "../../../helpers/shapes.ts";

describe("StairCornerInner", () => {
  const shape = new StairCornerInner();

  it("default id is 'stairCornerInner'", () => {
    assert.equal(shape.id, "stairCornerInner");
  });

  it("collisionHint is 'trimesh'", () => {
    assert.equal(shape.collisionHint, "trimesh");
  });

  it("has 12 faces (10 boundary quads + 2 interior riser quads)", () => {
    assert.equal(shape.faces.length, 12);
  });

  it("occludes NegY, PosZ, PosX", () => {
    assert.equal(shape.occludes(FACE.NegY), true);
    assert.equal(shape.occludes(FACE.PosZ), true);
    assert.equal(shape.occludes(FACE.PosX), true);
  });

  it("does not occlude NegX, PosY, NegZ", () => {
    assert.equal(shape.occludes(FACE.NegX), false);
    assert.equal(shape.occludes(FACE.PosY), false);
    assert.equal(shape.occludes(FACE.NegZ), false);
  });

  it("each face has 3 or 4 vertices", () => {
    checkVertexCounts("StairCornerInner", shape.faces);
  });

  it("each face has a unit normal", () => {
    checkNormalMagnitudes("StairCornerInner", shape.faces);
  });
});
