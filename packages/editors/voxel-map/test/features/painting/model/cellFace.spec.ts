// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  anchorsOf,
  CELL_FACES,
  cellFaceOf,
  faceCornersOf,
  isCellFace
} from "../../../../src/features/painting/model/cellFace.ts";

describe("isCellFace", () => {
  test("accepts the six faces and nothing else", () => {
    for (const face of CELL_FACES) {
      assert.ok(isCellFace(face));
    }

    for (const value of ["x", "+w", "", null, undefined, 1, { face: "+x" }]) {
      assert.ok(!isCellFace(value));
    }
  });
});

describe("cellFaceOf", () => {
  test("maps each unit direction to its face", () => {
    assert.strictEqual(cellFaceOf({ x: 1, y: 0, z: 0 }), "+x");
    assert.strictEqual(cellFaceOf({ x: -1, y: 0, z: 0 }), "-x");
    assert.strictEqual(cellFaceOf({ x: 0, y: 1, z: 0 }), "+y");
    assert.strictEqual(cellFaceOf({ x: 0, y: -1, z: 0 }), "-y");
    assert.strictEqual(cellFaceOf({ x: 0, y: 0, z: 1 }), "+z");
    assert.strictEqual(cellFaceOf({ x: 0, y: 0, z: -1 }), "-z");
  });

  test("snaps a slanted normal to its dominant axis", () => {
    assert.strictEqual(cellFaceOf({ x: 0, y: 0.7, z: -0.6 }), "+y");
    assert.strictEqual(cellFaceOf({ x: -0.8, y: 0.1, z: 0.5 }), "-x");
    assert.strictEqual(cellFaceOf({ x: 0.2, y: -0.3, z: -0.9 }), "-z");
  });

  test("prefers the vertical axis on a tie", () => {
    assert.strictEqual(cellFaceOf({ x: 0.5, y: -0.5, z: 0 }), "-y");
  });
});

describe("anchorsOf", () => {
  test("digs down from a top face and builds up from it", () => {
    assert.deepStrictEqual(anchorsOf("+y"), {
      place: "bottom",
      remove: "top"
    });
  });

  test("digs up from a bottom face and builds down from it", () => {
    assert.deepStrictEqual(anchorsOf("-y"), {
      place: "top",
      remove: "bottom"
    });
  });

  test("centers on a side face and without a face", () => {
    const centered = {
      place: "center",
      remove: "center"
    };

    for (const face of ["+x", "-x", "+z", "-z", null] as const) {
      assert.deepStrictEqual(anchorsOf(face), centered);
    }
  });
});

describe("faceCornersOf", () => {
  test("covers the top face of the aimed cell", () => {
    assert.deepStrictEqual(
      faceCornersOf({ x: 2, y: 0, z: -3 }, "+y"),
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
      faceCornersOf({ x: 2, y: 4, z: -3 }, "-y"),
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
      faceCornersOf({ x: 2, y: 0, z: -3 }, "+x"),
      [
        { x: 3, y: 0, z: -3 },
        { x: 3, y: 1, z: -3 },
        { x: 3, y: 1, z: -2 },
        { x: 3, y: 0, z: -2 }
      ]
    );
    assert.deepStrictEqual(
      faceCornersOf({ x: 2, y: 0, z: -3 }, "-z"),
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
      faceCornersOf({ x: 0, y: 0, z: 0 }, "-z", 0.25),
      [
        { x: -0.25, y: -0.25, z: -0.25 },
        { x: 1.25, y: -0.25, z: -0.25 },
        { x: 1.25, y: 1.25, z: -0.25 },
        { x: -0.25, y: 1.25, z: -0.25 }
      ]
    );
  });
});
