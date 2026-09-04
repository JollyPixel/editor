// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVFaceMap } from "#src/uv/UVFaceMap.ts";
import {
  UV_FACES,
  type UVGeometry
} from "#src/uv/UVRegion.ts";
import type { SelectionRect } from "#src/types.ts";

// CONSTANTS
const kRect: SelectionRect = { x: 1, y: 2, width: 3, height: 4 };
const kTriangle: UVGeometry = {
  shape: "triangle",
  corner: "top-right",
  rect: kRect
};

function fullRecord(
  geometry: UVGeometry = kRect
): Record<string, UVGeometry> {
  return Object.fromEntries(UV_FACES.map((face) => [face, geometry]));
}

describe("UVFaceMap", () => {
  describe("shared()", () => {
    test("gives every face the same rect value", () => {
      const faces = UVFaceMap.shared(kRect);

      for (const face of UV_FACES) {
        assert.deepStrictEqual(faces.get(face), kRect);
      }
    });

    test("gives each face an independent object", () => {
      const faces = UVFaceMap.shared(kRect);

      assert.notStrictEqual(faces.get("front"), faces.get("top"));
    });
  });

  describe("constructor", () => {
    test("copies incoming geometry instead of aliasing it", () => {
      const rect = { ...kRect };
      const faces = new UVFaceMap(fullRecord(rect) as Record<string, UVGeometry> as never);
      rect.x = 99;

      assert.strictEqual((faces.get("front") as SelectionRect).x, kRect.x);
    });
  });

  describe("get()", () => {
    test("returns a copy the caller cannot use to mutate the map", () => {
      const faces = UVFaceMap.shared(kRect);
      const geometry = faces.get("front") as SelectionRect;
      geometry.x = 99;

      assert.strictEqual((faces.get("front") as SelectionRect).x, kRect.x);
    });
  });

  describe("withFace()", () => {
    test("replaces only the named face", () => {
      const nextRect: SelectionRect = { x: 9, y: 9, width: 1, height: 1 };
      const faces = UVFaceMap.shared(kRect).withFace("left", nextRect);

      assert.deepStrictEqual(faces.get("left"), nextRect);
      for (const face of UV_FACES.filter((value) => value !== "left")) {
        assert.deepStrictEqual(faces.get(face), kRect, `${face} must stay put`);
      }
    });

    test("leaves the source instance untouched", () => {
      const nextRect: SelectionRect = { x: 9, y: 9, width: 1, height: 1 };
      const faces = UVFaceMap.shared(kRect);
      faces.withFace("left", nextRect);

      assert.deepStrictEqual(faces.get("left"), kRect);
    });
  });

  describe("translated()", () => {
    test("shifts every face without resizing it", () => {
      const faces = UVFaceMap.shared(kRect).translated(8, 7);

      for (const face of UV_FACES) {
        assert.deepStrictEqual(faces.get(face), {
          x: kRect.x + 8,
          y: kRect.y + 7,
          width: kRect.width,
          height: kRect.height
        });
      }
    });

    test("keeps each face's own size and offset", () => {
      const faces = new UVFaceMap({
        ...fullRecord(),
        front: { x: 0, y: 0, width: 4, height: 4 },
        top: { x: 10, y: 20, width: 16, height: 2 }
      } as Record<string, UVGeometry> as never).translated(5, 5);

      assert.deepStrictEqual(faces.get("front"), {
        x: 5, y: 5, width: 4, height: 4
      });
      assert.deepStrictEqual(faces.get("top"), {
        x: 15, y: 25, width: 16, height: 2
      });
    });

    test("preserves triangle shape metadata while moving its bounds", () => {
      const faces = new UVFaceMap(fullRecord(kTriangle) as Record<string, UVGeometry> as never);
      const moved = faces.translated(8, 7);

      assert.deepStrictEqual(moved.get("left"), {
        shape: "triangle",
        corner: "top-right",
        rect: {
          x: kRect.x + 8,
          y: kRect.y + 7,
          width: kRect.width,
          height: kRect.height
        }
      });
    });
  });

  describe("toJSON()", () => {
    test("returns a full record covering every face", () => {
      const data = UVFaceMap.shared(kRect).toJSON();

      assert.deepStrictEqual(
        Object.keys(data).sort(),
        [...UV_FACES].sort()
      );
    });

    test("returns copies the caller cannot use to mutate the map", () => {
      const faces = UVFaceMap.shared(kRect);
      const data = faces.toJSON();
      (data.front as SelectionRect).x = 99;

      assert.strictEqual((faces.get("front") as SelectionRect).x, kRect.x);
    });
  });
});
