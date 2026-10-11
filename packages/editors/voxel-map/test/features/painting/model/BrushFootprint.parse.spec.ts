// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { BrushFootprint } from "../../../../src/features/painting/model/BrushFootprint.ts";
import { CellFace } from "../../../../src/features/painting/model/CellFace.ts";

function parsed(
  value: unknown
) {
  const footprint = BrushFootprint.parse(value);

  return footprint === null ? null : footprint.toJSON();
}

describe("BrushFootprint.parse", () => {
  test("reads a well-formed payload", () => {
    assert.deepStrictEqual(
      parsed({
        position: { x: 1, y: 2, z: 3 },
        size: 2,
        pattern: "circle"
      }),
      {
        position: { x: 1, y: 2, z: 3 },
        size: 2,
        pattern: "circle"
      }
    );
  });

  test("ignores the axis and anchor an older client still sends", () => {
    assert.deepStrictEqual(
      parsed({
        position: { x: 1, y: 2, z: 3 },
        size: 2,
        axis: "xyz",
        anchor: "top"
      }),
      {
        position: { x: 1, y: 2, z: 3 },
        size: 2,
        pattern: "square"
      }
    );
  });

  test("falls back on an unknown pattern", () => {
    for (const pattern of [3, "rectangle"]) {
      const read = parsed({
        position: { x: 0, y: 0, z: 0 },
        size: 1,
        pattern
      });

      assert.strictEqual(read?.pattern, "square");
    }
  });

  test("reads the aimed face and drops an unknown one", () => {
    const base = {
      position: { x: 0, y: 0, z: 0 },
      size: 1
    };

    assert.strictEqual(parsed({ ...base, face: "-z" })?.face, "-z");
    for (const face of ["up", "+w", null]) {
      assert.ok(!("face" in parsed({ ...base, face })!));
    }
  });

  test("floors a fractional size", () => {
    assert.strictEqual(
      parsed({
        position: { x: 0, y: 0, z: 0 },
        size: 2.7
      })!.size,
      2
    );
  });

  test("rejects anything that is not a cursor", () => {
    const rejected = [
      null,
      undefined,
      42,
      {},
      { position: { x: 0, y: 0 }, size: 1 },
      { position: { x: 0, y: 0, z: "3" }, size: 1 },
      { position: { x: 0, y: 0, z: 0 }, size: 0 },
      { position: { x: 0, y: 0, z: 0 }, size: Number.NaN },
      { position: { x: 0, y: 0, z: 0 } }
    ];

    for (const value of rejected) {
      assert.strictEqual(parsed(value), null);
    }
  });
});

describe("BrushFootprint.equals", () => {
  const reference = new BrushFootprint({
    position: { x: 1, y: 2, z: 3 },
    size: 2,
    pattern: "square"
  });

  function withPatch(
    patch: Partial<ConstructorParameters<typeof BrushFootprint>[0]>
  ): BrushFootprint {
    return new BrushFootprint({
      position: reference.position,
      size: reference.size,
      pattern: reference.pattern,
      ...patch
    });
  }

  test("is never equal to null", () => {
    assert.ok(!reference.equals(null));
  });

  test("compares the aimed face", () => {
    assert.ok(withPatch({ face: CellFace.PosY }).equals(withPatch({ face: CellFace.PosY })));
    assert.ok(!reference.equals(withPatch({ face: CellFace.PosY })));
    assert.ok(!withPatch({ face: CellFace.PosY }).equals(withPatch({ face: CellFace.NegX })));
  });

  test("compares the center, size and pattern", () => {
    assert.ok(reference.equals(withPatch({})));
    assert.ok(!reference.equals(withPatch({ size: 3 })));
    assert.ok(!reference.equals(withPatch({ pattern: "circle" })));
    assert.ok(!reference.equals(withPatch({ position: { x: 1, y: 2, z: 4 } })));
  });

  test("round-trips through its JSON", () => {
    const aimed = withPatch({ face: CellFace.NegZ });

    assert.ok(aimed.equals(BrushFootprint.parse(JSON.parse(JSON.stringify(aimed)))));
  });
});
