// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { CellFace } from "../../../../src/features/painting/model/CellFace.ts";

describe("CellFace.fromDirection", () => {
  test("maps each unit direction to its face", () => {
    assert.strictEqual(CellFace.fromDirection({ x: 1, y: 0, z: 0 }).id, "+x");
    assert.strictEqual(CellFace.fromDirection({ x: -1, y: 0, z: 0 }).id, "-x");
    assert.strictEqual(CellFace.fromDirection({ x: 0, y: 1, z: 0 }).id, "+y");
    assert.strictEqual(CellFace.fromDirection({ x: 0, y: -1, z: 0 }).id, "-y");
    assert.strictEqual(CellFace.fromDirection({ x: 0, y: 0, z: 1 }).id, "+z");
    assert.strictEqual(CellFace.fromDirection({ x: 0, y: 0, z: -1 }).id, "-z");
  });

  test("snaps a slanted normal to its dominant axis", () => {
    assert.strictEqual(CellFace.fromDirection({ x: 0, y: 0.7, z: -0.6 }).id, "+y");
    assert.strictEqual(CellFace.fromDirection({ x: -0.8, y: 0.1, z: 0.5 }).id, "-x");
    assert.strictEqual(CellFace.fromDirection({ x: 0.2, y: -0.3, z: -0.9 }).id, "-z");
  });

  test("prefers the vertical axis on a tie", () => {
    assert.strictEqual(CellFace.fromDirection({ x: 0.5, y: -0.5, z: 0 }).id, "-y");
  });
});

describe("CellFace.anchors", () => {
  test("digs down from a top face and builds up from it", () => {
    assert.deepStrictEqual(CellFace.PosY.anchors, {
      place: "bottom",
      remove: "top"
    });
  });

  test("digs up from a bottom face and builds down from it", () => {
    assert.deepStrictEqual(CellFace.NegY.anchors, {
      place: "top",
      remove: "bottom"
    });
  });

  test("centers on a side face and without a face", () => {
    const centered = {
      place: "center",
      remove: "center"
    };

    for (const face of [CellFace.PosX, CellFace.NegX, CellFace.PosZ, CellFace.NegZ]) {
      assert.deepStrictEqual(face.anchors, centered);
    }
    assert.deepStrictEqual(CellFace.FREE_ANCHORS, centered);
  });
});

describe("CellFace.corners", () => {
  test("covers the top face of the aimed cell", () => {
    assert.deepStrictEqual(
      CellFace.parse("+y")!.corners({ x: 2, y: 0, z: -3 }),
      [
        { x: 2, y: 1, z: -3 },
        { x: 3, y: 1, z: -3 },
        { x: 3, y: 1, z: -2 },
        { x: 2, y: 1, z: -2 }
      ]
    );
  });

  test("covers the bottom face of the aimed cell", () => {
    assert.deepStrictEqual(
      CellFace.parse("-y")!.corners({ x: 2, y: 4, z: -3 }),
      [
        { x: 2, y: 4, z: -3 },
        { x: 3, y: 4, z: -3 },
        { x: 3, y: 4, z: -2 },
        { x: 2, y: 4, z: -2 }
      ]
    );
  });

  test("covers a side face of the aimed cell", () => {
    assert.deepStrictEqual(
      CellFace.parse("+x")!.corners({ x: 2, y: 0, z: -3 }),
      [
        { x: 3, y: 0, z: -3 },
        { x: 3, y: 1, z: -3 },
        { x: 3, y: 1, z: -2 },
        { x: 3, y: 0, z: -2 }
      ]
    );
    assert.deepStrictEqual(
      CellFace.parse("-z")!.corners({ x: 2, y: 0, z: -3 }),
      [
        { x: 2, y: 0, z: -3 },
        { x: 3, y: 0, z: -3 },
        { x: 3, y: 1, z: -3 },
        { x: 2, y: 1, z: -3 }
      ]
    );
  });

  test("grows and lifts the rectangle by the margin", () => {
    assert.deepStrictEqual(
      CellFace.parse("-z")!.corners({ x: 0, y: 0, z: 0 }, 0.25),
      [
        { x: -0.25, y: -0.25, z: -0.25 },
        { x: 1.25, y: -0.25, z: -0.25 },
        { x: 1.25, y: 1.25, z: -0.25 },
        { x: -0.25, y: 1.25, z: -0.25 }
      ]
    );
  });
});

describe("CellFace.parse", () => {
  test("reads a face id into its shared instance and rejects the rest", () => {
    assert.equal(CellFace.parse("-z"), CellFace.NegZ);
    assert.equal(JSON.stringify(CellFace.NegZ), "\"-z\"");
    for (const value of ["up", "+w", null, 3]) {
      assert.equal(CellFace.parse(value), undefined);
    }
  });
});
