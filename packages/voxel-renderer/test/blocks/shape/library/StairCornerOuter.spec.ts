// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { FACE } from "../../../../src/utils/math.ts";
import {
  StairCornerOuter
} from "../../../../src/blocks/shape/library/StairCornerOuter.ts";
import {
  checkNormalMagnitudes,
  checkVertexCounts
} from "../../../helpers/shapes.ts";

describe("StairCornerOuter", () => {
  const shape = new StairCornerOuter();

  it("default id is 'stairCornerOuter'", () => {
    assert.equal(shape.id, "stairCornerOuter");
  });

  it("collisionHint is 'trimesh'", () => {
    assert.equal(shape.collisionHint, "trimesh");
  });

  it("has 13 faces (11 boundary quads + 2 interior riser quads)", () => {
    assert.equal(shape.faces.length, 13);
  });

  it("occludes only NegY", () => {
    assert.equal(shape.occludes(FACE.NegY), true);
    const faces = [
      FACE.PosX,
      FACE.NegX,
      FACE.PosY,
      FACE.PosZ,
      FACE.NegZ
    ];
    for (const face of faces) {
      assert.equal(
        shape.occludes(face),
        false,
        `expected occludes(${face}) to be false`
      );
    }
  });

  it("each face has 3 or 4 vertices", () => {
    checkVertexCounts("StairCornerOuter", shape.faces);
  });

  it("each face has a unit normal", () => {
    checkNormalMagnitudes("StairCornerOuter", shape.faces);
  });
});
