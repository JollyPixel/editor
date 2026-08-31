// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { FACE } from "../../../src/utils/math.ts";
import { Stair } from "../../../src/blocks/shapes/Stair.ts";
import {
  checkNormalMagnitudes,
  checkVertexCounts
} from "../../helpers/shapes.ts";

describe("Stair", () => {
  const stair = new Stair();

  it("default id is 'stair'", () => {
    assert.equal(stair.id, "stair");
  });

  it("collisionHint is 'trimesh'", () => {
    assert.equal(stair.collisionHint, "trimesh");
  });

  it("has 10 faces (9 boundary quads + 1 interior riser quad)", () => {
    assert.equal(stair.faces.length, 10);
  });

  it("occludes NegY and PosZ", () => {
    assert.equal(stair.occludes(FACE.NegY), true);
    assert.equal(stair.occludes(FACE.PosZ), true);
  });

  it("does not occlude PosX, NegX, PosY, NegZ", () => {
    assert.equal(stair.occludes(FACE.PosX), false);
    assert.equal(stair.occludes(FACE.NegX), false);
    assert.equal(stair.occludes(FACE.PosY), false);
    assert.equal(stair.occludes(FACE.NegZ), false);
  });

  it("each face has 3 or 4 vertices", () => {
    checkVertexCounts("Stair", stair.faces);
  });

  it("each face has a unit normal", () => {
    checkNormalMagnitudes("Stair", stair.faces);
  });
});
