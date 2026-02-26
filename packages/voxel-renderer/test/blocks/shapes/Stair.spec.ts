// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { FACE } from "../../../src/utils/math.ts";
import {
  Stair,
  StairCornerInner,
  StairCornerOuter
} from "../../../src/blocks/shapes/Stair.ts";

function checkNormalMagnitudes(shapeName: string, faces: any[]): void {
  for (let i = 0; i < faces.length; i++) {
    const { normal } = faces[i];
    const mag = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
    assert.ok(
      Math.abs(mag - 1.0) < 1e-9,
      `${shapeName} face[${i}] normal magnitude is ${mag}, expected 1.0`
    );
  }
}

function checkVertexCounts(shapeName: string, faces: any[]): void {
  for (let i = 0; i < faces.length; i++) {
    const count = faces[i].vertices.length;
    assert.ok(
      count === 3 || count === 4,
      `${shapeName} face[${i}] has ${count} vertices, expected 3 or 4`
    );
  }
}

// ── Stair ────────────────────────────────────────────────────────────────────

describe("Stair", () => {
  const stair = new Stair();

  it("default id is 'stair'", () => {
    assert.equal(stair.id, "stair");
  });

  it("collisionHint is 'trimesh'", () => {
    assert.equal(stair.collisionHint, "trimesh");
  });

  it("has 10 faces", () => {
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
    checkVertexCounts("Stair", stair.faces as any[]);
  });

  it("each face has a unit normal", () => {
    checkNormalMagnitudes("Stair", stair.faces as any[]);
  });
});

// ── StairCornerInner ─────────────────────────────────────────────────────────

describe("StairCornerInner", () => {
  const shape = new StairCornerInner();

  it("default id is 'stairCornerInner'", () => {
    assert.equal(shape.id, "stairCornerInner");
  });

  it("collisionHint is 'trimesh'", () => {
    assert.equal(shape.collisionHint, "trimesh");
  });

  it("has 12 faces", () => {
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
    checkVertexCounts("StairCornerInner", shape.faces as any[]);
  });

  it("each face has a unit normal", () => {
    checkNormalMagnitudes("StairCornerInner", shape.faces as any[]);
  });
});

// ── StairCornerOuter ─────────────────────────────────────────────────────────

describe("StairCornerOuter", () => {
  const shape = new StairCornerOuter();

  it("default id is 'stairCornerOuter'", () => {
    assert.equal(shape.id, "stairCornerOuter");
  });

  it("collisionHint is 'trimesh'", () => {
    assert.equal(shape.collisionHint, "trimesh");
  });

  it("has 13 faces", () => {
    assert.equal(shape.faces.length, 13);
  });

  it("occludes only NegY", () => {
    assert.equal(shape.occludes(FACE.NegY), true);
    for (const face of [FACE.PosX, FACE.NegX, FACE.PosY, FACE.PosZ, FACE.NegZ]) {
      assert.equal(shape.occludes(face), false, `expected occludes(${face}) to be false`);
    }
  });

  it("each face has 3 or 4 vertices", () => {
    checkVertexCounts("StairCornerOuter", shape.faces as any[]);
  });

  it("each face has a unit normal", () => {
    checkNormalMagnitudes("StairCornerOuter", shape.faces as any[]);
  });
});

// ── BlockShapeRegistry integration ──────────────────────────────────────────

describe("BlockShapeRegistry — stair shapes registered", () => {
  it("all 3 stair shapes are present in createDefault()", async() => {
    const { BlockShapeRegistry } = await import("../../../src/blocks/BlockShapeRegistry.ts");
    const registry = BlockShapeRegistry.createDefault();
    const ids = [
      "stair",
      "stairCornerInner",
      "stairCornerOuter"
    ];

    for (const id of ids) {
      assert.ok(registry.has(id), `Expected registry to have shape id "${id}"`);
    }
  });
});
