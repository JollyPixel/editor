// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { FACE } from "../../../src/utils/math.ts";
import {
  Stair,
  StairCornerInner,
  StairCornerOuter,
  StairFlip,
  StairCornerInnerFlip,
  StairCornerOuterFlip
} from "../../../src/blocks/shapes/Stair.ts";
import {
  RampCornerInnerFlip,
  RampCornerOuterFlip
} from "../../../src/blocks/shapes/RampCorner.ts";

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

// ── StairFlip ─────────────────────────────────────────────────────────────

describe("StairFlip", () => {
  const shape = new StairFlip();

  it("default id is 'stairFlip'", () => {
    assert.equal(shape.id, "stairFlip");
  });

  it("collisionHint is 'trimesh'", () => {
    assert.equal(shape.collisionHint, "trimesh");
  });

  it("has 10 faces (same count as Stair)", () => {
    assert.equal(shape.faces.length, 10);
  });

  it("occludes PosY and PosZ", () => {
    assert.equal(shape.occludes(FACE.PosY), true);
    assert.equal(shape.occludes(FACE.PosZ), true);
  });

  it("does not occlude PosX, NegX, NegY, NegZ", () => {
    assert.equal(shape.occludes(FACE.PosX), false);
    assert.equal(shape.occludes(FACE.NegX), false);
    assert.equal(shape.occludes(FACE.NegY), false);
    assert.equal(shape.occludes(FACE.NegZ), false);
  });

  it("each face has 3 or 4 vertices", () => {
    checkVertexCounts("StairFlip", shape.faces as any[]);
  });

  it("each face has a unit normal", () => {
    checkNormalMagnitudes("StairFlip", shape.faces as any[]);
  });

  it("y-coordinates are flipped relative to Stair (same face order, reversed vertices)", () => {
    const stair = new Stair();

    for (let i = 0; i < stair.faces.length; i++) {
      const origFace = stair.faces[i];
      const revFace = shape.faces[i];
      const n = origFace.vertices.length;

      for (let v = 0; v < n; v++) {
        // yFlipFace reverses vertex order, so vertex v in rev == vertex (n-1-v) in orig, y-flipped
        const origY = origFace.vertices[n - 1 - v][1];
        const revY = revFace.vertices[v][1];
        assert.ok(
          Math.abs((origY + revY) - 1) < 1e-9,
          `StairFlip face[${i}] vertex[${v}]: origY(${origY}) + revY(${revY}) should equal 1`
        );
      }
    }
  });
});

// ── StairCornerInnerFlip ──────────────────────────────────────────────────

describe("StairCornerInnerFlip", () => {
  const shape = new StairCornerInnerFlip();

  it("default id is 'stairCornerInnerFlip'", () => {
    assert.equal(shape.id, "stairCornerInnerFlip");
  });

  it("collisionHint is 'trimesh'", () => {
    assert.equal(shape.collisionHint, "trimesh");
  });

  it("has 10 faces", () => {
    assert.equal(shape.faces.length, 12);
  });

  it("occludes PosY, PosZ, PosX", () => {
    assert.equal(shape.occludes(FACE.PosY), true);
    assert.equal(shape.occludes(FACE.PosZ), true);
    assert.equal(shape.occludes(FACE.PosX), true);
  });

  it("does not occlude NegX, NegY, NegZ", () => {
    assert.equal(shape.occludes(FACE.NegX), false);
    assert.equal(shape.occludes(FACE.NegY), false);
    assert.equal(shape.occludes(FACE.NegZ), false);
  });

  it("each face has 3 or 4 vertices", () => {
    checkVertexCounts("StairCornerInnerFlip", shape.faces as any[]);
  });

  it("each face has a unit normal", () => {
    checkNormalMagnitudes("StairCornerInnerFlip", shape.faces as any[]);
  });
});

// ── StairCornerOuterFlip ──────────────────────────────────────────────────

describe("StairCornerOuterFlip", () => {
  const shape = new StairCornerOuterFlip();

  it("default id is 'stairCornerOuterFlip'", () => {
    assert.equal(shape.id, "stairCornerOuterFlip");
  });

  it("collisionHint is 'trimesh'", () => {
    assert.equal(shape.collisionHint, "trimesh");
  });

  it("has 13 faces", () => {
    assert.equal(shape.faces.length, 13);
  });

  it("occludes only PosY", () => {
    assert.equal(shape.occludes(FACE.PosY), true);
    for (const face of [FACE.PosX, FACE.NegX, FACE.NegY, FACE.PosZ, FACE.NegZ]) {
      assert.equal(shape.occludes(face), false, `expected occludes(${face}) to be false`);
    }
  });

  it("each face has 3 or 4 vertices", () => {
    checkVertexCounts("StairCornerOuterFlip", shape.faces as any[]);
  });

  it("each face has a unit normal", () => {
    checkNormalMagnitudes("StairCornerOuterFlip", shape.faces as any[]);
  });
});

// ── RampCornerInnerFlip ───────────────────────────────────────────────────────

describe("RampCornerInnerFlip", () => {
  const shape = new RampCornerInnerFlip();

  it("default id is 'rampCornerInnerFlip'", () => {
    assert.equal(shape.id, "rampCornerInnerFlip");
  });

  it("collisionHint is 'trimesh'", () => {
    assert.equal(shape.collisionHint, "trimesh");
  });

  it("has 7 faces (same count as CornerInner)", () => {
    assert.equal(shape.faces.length, 7);
  });

  it("occludes PosY, PosZ, PosX", () => {
    assert.equal(shape.occludes(FACE.PosY), true);
    assert.equal(shape.occludes(FACE.PosZ), true);
    assert.equal(shape.occludes(FACE.PosX), true);
  });

  it("does not occlude NegX, NegY, NegZ", () => {
    assert.equal(shape.occludes(FACE.NegX), false);
    assert.equal(shape.occludes(FACE.NegY), false);
    assert.equal(shape.occludes(FACE.NegZ), false);
  });

  it("each face has 3 or 4 vertices", () => {
    checkVertexCounts("RampCornerInnerFlip", shape.faces as any[]);
  });

  it("each face has a unit normal", () => {
    checkNormalMagnitudes("RampCornerInnerFlip", shape.faces as any[]);
  });
});

// ── RampCornerOuterFlip ───────────────────────────────────────────────────────

describe("RampCornerOuterFlip", () => {
  const shape = new RampCornerOuterFlip();

  it("default id is 'rampCornerOuterFlip'", () => {
    assert.equal(shape.id, "rampCornerOuterFlip");
  });

  it("collisionHint is 'trimesh'", () => {
    assert.equal(shape.collisionHint, "trimesh");
  });

  it("has 5 faces (same count as CornerOuter)", () => {
    assert.equal(shape.faces.length, 5);
  });

  it("occludes only PosY", () => {
    assert.equal(shape.occludes(FACE.PosY), true);
    for (const face of [FACE.PosX, FACE.NegX, FACE.NegY, FACE.PosZ, FACE.NegZ]) {
      assert.equal(shape.occludes(face), false, `expected occludes(${face}) to be false`);
    }
  });

  it("each face has 3 or 4 vertices", () => {
    checkVertexCounts("RampCornerOuterFlip", shape.faces as any[]);
  });

  it("each face has a unit normal", () => {
    checkNormalMagnitudes("RampCornerOuterFlip", shape.faces as any[]);
  });
});

// ── BlockShapeRegistry integration ──────────────────────────────────────────

describe("BlockShapeRegistry — new shapes registered", () => {
  it("all 8 new shapes are present in createDefault()", async() => {
    const { BlockShapeRegistry } = await import("../../../src/blocks/BlockShapeRegistry.ts");
    const registry = BlockShapeRegistry.createDefault();
    const newIds = [
      "stair",
      "stairCornerInner",
      "stairCornerOuter",
      "stairFlip",
      "stairCornerInnerFlip",
      "stairCornerOuterFlip",
      "rampCornerInnerFlip",
      "rampCornerOuterFlip"
    ];

    for (const id of newIds) {
      assert.ok(registry.has(id), `Expected registry to have shape id "${id}"`);
    }
  });
});
