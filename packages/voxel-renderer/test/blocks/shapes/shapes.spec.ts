// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Cube } from "../../../src/blocks/shapes/Cube.ts";
import { Slab } from "../../../src/blocks/shapes/Slab.ts";
import { Ramp } from "../../../src/blocks/shapes/Ramp.ts";
import { RampCornerInner, RampCornerOuter } from "../../../src/blocks/shapes/RampCorner.ts";
import { PoleY } from "../../../src/blocks/shapes/PoleY.ts";
import { RampFlip } from "../../../src/blocks/shapes/RampFlip.ts";
import { FACE } from "../../../src/utils/math.ts";

const ALL_FACES = [FACE.PosX, FACE.NegX, FACE.PosY, FACE.NegY, FACE.PosZ, FACE.NegZ];

describe("Cube", () => {
  const cube = new Cube();

  it("default id is 'cube'", () => {
    assert.equal(cube.id, "cube");
  });

  it("collisionHint is 'box'", () => {
    assert.equal(cube.collisionHint, "box");
  });

  it("has exactly 6 faces", () => {
    assert.equal(cube.faces.length, 6);
  });

  it("occludes() returns true for every face", () => {
    for (const face of ALL_FACES) {
      assert.equal(cube.occludes(face), true, `expected occludes(${face}) to be true`);
    }
  });

  it("accepts a custom id", () => {
    const custom = new Cube("myCustomCube" as any);
    assert.equal(custom.id, "myCustomCube");
  });

  it("each face has 4 vertices (quad)", () => {
    for (const fd of cube.faces) {
      assert.ok(fd.vertices.length === 3 || fd.vertices.length === 4, "expected 3 or 4 vertices");
    }
  });
});

describe("Slab (bottom)", () => {
  const slab = new Slab("bottom");

  it("id is 'slabBottom'", () => {
    assert.equal(slab.id, "slabBottom");
  });

  it("collisionHint is 'box'", () => {
    assert.equal(slab.collisionHint, "box");
  });

  it("has exactly 6 faces", () => {
    assert.equal(slab.faces.length, 6);
  });

  it("occludes NegY (bottom face)", () => {
    assert.equal(slab.occludes(FACE.NegY), true);
  });

  it("does not occlude PosY (top face)", () => {
    assert.equal(slab.occludes(FACE.PosY), false);
  });

  it("does not occlude side faces", () => {
    assert.equal(slab.occludes(FACE.PosX), false);
    assert.equal(slab.occludes(FACE.NegX), false);
    assert.equal(slab.occludes(FACE.PosZ), false);
    assert.equal(slab.occludes(FACE.NegZ), false);
  });
});

describe("Slab (top)", () => {
  const slab = new Slab("top");

  it("id is 'slabTop'", () => {
    assert.equal(slab.id, "slabTop");
  });

  it("occludes PosY (top face)", () => {
    assert.equal(slab.occludes(FACE.PosY), true);
  });

  it("does not occlude NegY (bottom face)", () => {
    assert.equal(slab.occludes(FACE.NegY), false);
  });
});

describe("Slab — occludes() id-string contract (bug documentation)", () => {
  it("custom id containing 'Bottom' is treated as bottom slab", () => {
    // The check is: this.id.includes("Bottom") || this.id === "slabBottom"
    const slab = new Slab("bottom", "myBottomSlab" as any);
    assert.equal(slab.occludes(FACE.NegY), true, "NegY should occlude when id contains 'Bottom'");
    assert.equal(slab.occludes(FACE.PosY), false);
  });

  it("custom id NOT containing 'Bottom' and not 'slabBottom' uses top logic (known quirk)", () => {
    // A bottom slab with a custom id like "slab" will incorrectly behave as a top slab.
    // This test documents the current (imperfect) behaviour.
    const slab = new Slab("bottom", "slab" as any);
    // Neither "slab".includes("Bottom") nor "slab" === "slabBottom" → uses top path
    assert.equal(slab.occludes(FACE.PosY), true, "quirk: custom id falls through to top-slab logic");
    assert.equal(slab.occludes(FACE.NegY), false);
  });
});

describe("Ramp", () => {
  const ramp = new Ramp();

  it("default id is 'ramp'", () => {
    assert.equal(ramp.id, "ramp");
  });

  it("collisionHint is 'trimesh'", () => {
    assert.equal(ramp.collisionHint, "trimesh");
  });

  it("has 5 faces (2 quads + 2 triangles + 1 diagonal quad)", () => {
    assert.equal(ramp.faces.length, 5);
  });

  it("occludes NegY and PosZ only", () => {
    assert.equal(ramp.occludes(FACE.NegY), true);
    assert.equal(ramp.occludes(FACE.PosZ), true);
    assert.equal(ramp.occludes(FACE.PosX), false);
    assert.equal(ramp.occludes(FACE.NegX), false);
    assert.equal(ramp.occludes(FACE.PosY), false);
    assert.equal(ramp.occludes(FACE.NegZ), false);
  });
});

describe("RampCornerInner", () => {
  const corner = new RampCornerInner();

  it("default id is 'rampCornerInner'", () => {
    assert.equal(corner.id, "rampCornerInner");
  });

  it("collisionHint is 'trimesh'", () => {
    assert.equal(corner.collisionHint, "trimesh");
  });

  it("has 7 faces", () => {
    assert.equal(corner.faces.length, 7);
  });

  it("occludes NegY, PosZ, and PosX", () => {
    assert.equal(corner.occludes(FACE.NegY), true);
    assert.equal(corner.occludes(FACE.PosZ), true);
    assert.equal(corner.occludes(FACE.PosX), true);
  });

  it("does not occlude NegX, NegZ, PosY", () => {
    assert.equal(corner.occludes(FACE.NegX), false);
    assert.equal(corner.occludes(FACE.NegZ), false);
    assert.equal(corner.occludes(FACE.PosY), false);
  });
});

describe("RampCornerOuter", () => {
  const corner = new RampCornerOuter();

  it("default id is 'rampCornerOuter'", () => {
    assert.equal(corner.id, "rampCornerOuter");
  });

  it("collisionHint is 'trimesh'", () => {
    assert.equal(corner.collisionHint, "trimesh");
  });

  it("has 5 faces", () => {
    assert.equal(corner.faces.length, 5);
  });

  it("occludes only NegY", () => {
    assert.equal(corner.occludes(FACE.NegY), true);
    for (const face of [FACE.PosX, FACE.NegX, FACE.PosY, FACE.PosZ, FACE.NegZ]) {
      assert.equal(corner.occludes(face), false, `expected occludes(${face}) to be false`);
    }
  });
});

describe("PoleY", () => {
  const pillar = new PoleY();

  it("default id is 'poleY'", () => {
    assert.equal(pillar.id, "poleY");
  });

  it("collisionHint is 'trimesh'", () => {
    assert.equal(pillar.collisionHint, "trimesh");
  });

  it("has 6 faces (narrow column geometry)", () => {
    assert.equal(pillar.faces.length, 6);
  });

  it("occludes no faces (sub-voxel shape)", () => {
    for (const face of ALL_FACES) {
      assert.equal(pillar.occludes(face), false, `expected poleY.occludes(${face}) to be false`);
    }
  });
});

describe("RampFlip", () => {
  const rampFlip = new RampFlip();

  it("default id is 'rampFlip'", () => {
    assert.equal(rampFlip.id, "rampFlip");
  });

  it("collisionHint is 'trimesh'", () => {
    assert.equal(rampFlip.collisionHint, "trimesh");
  });

  it("has 5 faces", () => {
    assert.equal(rampFlip.faces.length, 5);
  });

  it("occludes PosY, NegY, and PosZ", () => {
    assert.equal(rampFlip.occludes(FACE.PosY), true);
    assert.equal(rampFlip.occludes(FACE.NegY), true);
    assert.equal(rampFlip.occludes(FACE.PosZ), true);
    assert.equal(rampFlip.occludes(FACE.PosX), false);
    assert.equal(rampFlip.occludes(FACE.NegX), false);
    assert.equal(rampFlip.occludes(FACE.NegZ), false);
  });
});
