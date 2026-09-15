// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  uvSlotGeometries,
  uvSlotMask
} from "#src/uv/uvSlotMask.ts";
import { UVRegion } from "#src/uv/UVRegion.ts";
import type { UVGeometry } from "#src/uv/types.ts";
import type { Vec2 } from "#src/types.ts";
import { makeMap } from "../helpers/uv-map.ts";

function maskRows(
  mask: Uint8Array,
  size: Vec2
): string[] {
  const rows: string[] = [];
  for (let y = 0; y < size.y; y++) {
    rows.push(
      [...mask.subarray(y * size.x, (y + 1) * size.x)].join("")
    );
  }

  return rows;
}

describe("uvSlotMask", () => {
  test("marks the pixels of a rect slot", () => {
    const size = { x: 5, y: 4 };
    const mask = uvSlotMask(
      [{ x: 1, y: 1, width: 3, height: 2 }],
      size
    );

    assert.deepStrictEqual(maskRows(mask, size), [
      "00000",
      "01110",
      "01110",
      "00000"
    ]);
  });

  test("clips geometry that extends past the texture", () => {
    const size = { x: 4, y: 2 };
    const mask = uvSlotMask(
      [{ x: -2, y: 1, width: 4, height: 5 }],
      size
    );

    assert.deepStrictEqual(maskRows(mask, size), [
      "0000",
      "1100"
    ]);
  });

  test("gives the diagonal row to both complementary triangles", () => {
    const size = { x: 4, y: 4 };
    const rect = { x: 0, y: 0, width: 4, height: 4 };
    const upper = uvSlotMask(
      [{ shape: "triangle", corner: "top-right", rect }],
      size
    );
    const lower = uvSlotMask(
      [{ shape: "triangle", corner: "bottom-left", rect }],
      size
    );

    assert.deepStrictEqual(maskRows(upper, size), [
      "1111",
      "0111",
      "0011",
      "0001"
    ]);
    assert.deepStrictEqual(maskRows(lower, size), [
      "1000",
      "1100",
      "1110",
      "1111"
    ]);
  });

  test("respects compound parts", () => {
    const size = { x: 4, y: 4 };
    const compound: UVGeometry = {
      shape: "compound",
      rect: { x: 0, y: 0, width: 4, height: 4 },
      parts: [
        { x: 0, y: 0, width: 0.5, height: 0.5 },
        { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }
      ]
    };

    assert.deepStrictEqual(maskRows(uvSlotMask([compound], size), size), [
      "1100",
      "1100",
      "0011",
      "0011"
    ]);
  });

  test("marks the union of overlapping slots", () => {
    const size = { x: 4, y: 1 };
    const mask = uvSlotMask(
      [
        { x: 0, y: 0, width: 2, height: 1 },
        { x: 1, y: 0, width: 2, height: 1 }
      ],
      size
    );

    assert.deepStrictEqual(maskRows(mask, size), ["1110"]);
  });
});

describe("uvSlotGeometries", () => {
  const faces = {
    front: { x: 0, y: 0, width: 2, height: 2 },
    back: { x: 4, y: 0, width: 2, height: 2 }
  };

  test("uses the single rect of a stacked region", () => {
    const region = new UVRegion({
      id: "stacked",
      color: "#fff",
      state: "stacked",
      rect: { x: 1, y: 1, width: 3, height: 3 },
      faces
    });

    assert.deepStrictEqual(uvSlotGeometries([region]), [
      { x: 1, y: 1, width: 3, height: 3 }
    ]);
  });

  test("uses every active slot of an unfolded region, leaving net gaps out", () => {
    const size = { x: 6, y: 2 };
    const region = new UVRegion({
      id: "unfolded",
      color: "#fff",
      state: "unfolded",
      faces
    });
    const mask = uvSlotMask(uvSlotGeometries([region]), size);

    assert.deepStrictEqual(maskRows(mask, size), [
      "110011",
      "110011"
    ]);
  });

  test("excludes inactive slots", () => {
    const region = new UVRegion({
      id: "free",
      color: "#fff",
      state: "free",
      faces,
      activeFaces: ["back"]
    });

    assert.deepStrictEqual(uvSlotGeometries([region]), [faces.back]);
  });

  test("includes regions hidden by the UV map view state", () => {
    const map = makeMap({ x: 8, y: 8 });
    const region = map.restore({
      id: "hidden",
      color: "#fff",
      state: "stacked",
      rect: { x: 2, y: 2, width: 2, height: 2 }
    });
    map.showAll = false;
    map.select(null);

    assert.ok(!map.isVisible(region.id));
    assert.deepStrictEqual(uvSlotGeometries(map.regions), [
      { x: 2, y: 2, width: 2, height: 2 }
    ]);
  });
});
