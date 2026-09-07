// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  UVRegion,
  UV_FACES,
  type UVSlot
} from "#src/uv/UVRegion.ts";
import type { SelectionRect } from "#src/types.ts";

// CONSTANTS
const kRect: SelectionRect = { x: 1, y: 2, width: 3, height: 4 };

function makeStacked(
  rect: SelectionRect = kRect
): UVRegion {
  return new UVRegion({ state: "stacked", id: "r1", color: "#f00", rect });
}

function makeFree(): UVRegion {
  return makeStacked().free();
}

describe("UVRegion", () => {
  describe("construction", () => {
    test("defaults to stacked when state is omitted", () => {
      const region = new UVRegion({ state: "stacked", id: "r1", color: "#f00", rect: kRect });

      assert.strictEqual(region.state, "stacked");
      assert.strictEqual(region.name, undefined);
      assert.deepStrictEqual(region.rectFor("front"), kRect);
    });

    test("keeps an optional name", () => {
      const region = new UVRegion({
        state: "stacked",
        id: "r1",
        name: "Grass block",
        color: "#f00",
        rect: kRect
      });

      assert.strictEqual(region.name, "Grass block");
    });

    test("parses an explicit free payload", () => {
      const faces = {
        front: { x: 0, y: 0, width: 1, height: 1 },
        back: { x: 1, y: 0, width: 1, height: 1 },
        left: { x: 2, y: 0, width: 1, height: 1 },
        right: { x: 3, y: 0, width: 1, height: 1 },
        top: { x: 4, y: 0, width: 1, height: 1 },
        bottom: { x: 5, y: 0, width: 1, height: 1 }
      };
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "free",
        faces
      });

      assert.strictEqual(region.state, "free");
      for (const face of UV_FACES) {
        assert.deepStrictEqual(
          region.rectFor(face),
          faces[face],
          `${face} must keep its own rect`
        );
      }
    });

    test("copies the incoming rect instead of aliasing it", () => {
      const rect = { ...kRect };
      const region = new UVRegion({ state: "stacked", id: "r1", color: "#f00", rect });
      rect.x = 99;

      assert.strictEqual(
        region.rectFor("front").x,
        kRect.x,
        "later caller mutation must not reach the region"
      );
    });

    test("from() passes an existing instance through unchanged", () => {
      const region = makeStacked();

      assert.strictEqual(UVRegion.from(region), region);
    });

    test("from() builds an instance out of raw data", () => {
      const region = UVRegion.from({ state: "stacked", id: "r1", color: "#f00", rect: kRect });

      assert.ok(region instanceof UVRegion);
      assert.strictEqual(region.state, "stacked");
    });
  });

  describe("rectFor / facesOf", () => {
    test("a stacked region returns its single rect for every face", () => {
      const region = makeStacked();

      for (const face of UV_FACES) {
        assert.deepStrictEqual(region.rectFor(face), kRect, `${face} must share the rect`);
      }
    });

    test("facesOf yields one null-faced entry when stacked", () => {
      assert.deepStrictEqual(
        makeStacked().facesOf(),
        [{ face: null, geometry: kRect }]
      );
    });

    test("keeps triangle geometry and its bounds separate", () => {
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "free",
        activeFaces: ["left"],
        faces: {
          front: kRect,
          back: kRect,
          left: { shape: "triangle", corner: "top-right", rect: kRect },
          right: kRect,
          top: kRect,
          bottom: kRect
        }
      });

      assert.deepStrictEqual(region.rectFor("left"), kRect);
      assert.deepStrictEqual(region.facesOf(), [{
        face: "left",
        geometry: { shape: "triangle", corner: "top-right", rect: kRect }
      }]);
    });

    test("facesOf yields six entries in UV_FACES order when free", () => {
      const faces = makeFree().facesOf();

      assert.deepStrictEqual(
        faces.map((entry) => entry.face),
        [...UV_FACES],
        "iteration order drives hit-testing and paint order"
      );
    });

    test("keeps active faces in the order the region declared them", () => {
      const rect = { ...kRect };
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "free",
        activeFaces: ["top", "left", "top"],
        faces: {
          front: rect,
          back: rect,
          left: rect,
          right: rect,
          top: rect,
          bottom: rect
        }
      });

      assert.deepStrictEqual(
        region.facesOf().map(({ face }) => face),
        ["top", "left"]
      );
    });

    test("geometryFor returns a copy", () => {
      const region = makeStacked();
      const geometry = region.geometryFor("front");
      if ("shape" in geometry) {
        assert.fail("expected rectangle geometry");
      }
      geometry.x = 99;

      assert.strictEqual(region.rectFor("front").x, kRect.x);
    });

    test("rectFor returns a copy", () => {
      const region = makeStacked();
      const rect = region.rectFor("front");
      rect.x = 99;

      assert.strictEqual(region.rectFor("front").x, kRect.x);
    });

    test("facesOf returns geometry copies", () => {
      const region = makeFree();
      const [{ geometry }] = region.facesOf();
      if ("shape" in geometry) {
        assert.fail("expected rectangle geometry");
      }
      geometry.x = 99;

      assert.strictEqual(region.rectFor("front").x, kRect.x);
    });
  });

  describe("free", () => {
    test("gives every face the current rect, so the mesh does not change", () => {
      const region = makeFree();

      assert.strictEqual(region.state, "free");
      for (const face of UV_FACES) {
        assert.deepStrictEqual(region.rectFor(face), kRect, `${face} must start where the region was`);
      }
    });

    test("gives each face an independent rect object", () => {
      const region = makeFree();

      assert.notStrictEqual(
        region.rectFor("front"),
        region.rectFor("top"),
        "faces must not share one object, or moving one would move all"
      );
    });

    test("returns the same instance when already free", () => {
      const region = makeFree();

      assert.strictEqual(region.free(), region);
    });

    test("leaves the source region untouched", () => {
      const region = makeStacked();
      region.free();

      assert.strictEqual(region.state, "stacked");
    });
  });

  describe("stack", () => {
    test("keeps the front face by default", () => {
      const moved = makeFree().withRect({ x: 9, y: 9, width: 1, height: 1 }, "top");
      const stacked = moved.stack();

      assert.strictEqual(stacked.state, "stacked");
      assert.deepStrictEqual(stacked.rectFor("front"), kRect);
    });

    test("uses the requested face as the shared rectangle among equally large ones", () => {
      const topRect = { ...kRect, x: 9, y: 9 };
      const stacked = makeFree()
        .withRect(topRect, "top")
        .stack("top");

      for (const face of UV_FACES) {
        assert.deepStrictEqual(
          stacked.rectFor(face),
          topRect,
          `${face} must adopt the surviving rect`
        );
      }
    });

    test("ignores a requested face smaller than the largest one", () => {
      const stacked = makeFree()
        .withRect({ x: 9, y: 9, width: 1, height: 1 }, "top")
        .stack("top");

      assert.strictEqual(stacked.stackedFace, "front");
      assert.deepStrictEqual(
        stacked.rectFor("top"),
        kRect,
        "a partial slot must not become the shared rectangle"
      );
    });

    test("returns the same instance when already stacked", () => {
      const region = makeStacked();

      assert.strictEqual(region.stack(), region);
    });

    test("prefers a rectangle among equally large faces", () => {
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "free",
        activeFaces: ["left", "top"],
        faces: {
          front: kRect,
          back: kRect,
          left: { shape: "triangle", corner: "top-right", rect: kRect },
          right: kRect,
          top: { ...kRect, x: 9, y: 9 },
          bottom: kRect
        }
      });

      const stacked = region.stack("left");

      assert.strictEqual(stacked.stackedFace, "top");
      assert.deepStrictEqual(stacked.rectFor("front"), { ...kRect, x: 9, y: 9 });
    });

    test("restores triangle topology after stacking and freeing", () => {
      const ramp = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "free",
        activeFaces: ["back", "left", "right", "top", "bottom"],
        faces: {
          front: kRect,
          back: kRect,
          left: { shape: "triangle", corner: "top-right", rect: kRect },
          right: { shape: "triangle", corner: "top-right", rect: kRect },
          top: kRect,
          bottom: kRect
        }
      });

      const restored = ramp.stack().free();

      assert.deepStrictEqual(restored.facesOf().map(({ face }) => face), [
        "back", "left", "right", "top", "bottom"
      ]);
      assert.deepStrictEqual(restored.geometryFor("left"), {
        shape: "triangle", corner: "top-right", rect: kRect
      });
    });

    test("serializes retained faces even when no face is triangular", () => {
      const pole = new UVRegion({
        id: "p1",
        color: "#f00",
        state: "free",
        faces: {
          front: { x: 6, y: 6, width: 4, height: 4 },
          back: { x: 6, y: 6, width: 4, height: 4 },
          left: { x: 0, y: 6, width: 16, height: 4 },
          right: { x: 0, y: 6, width: 16, height: 4 },
          top: { x: 6, y: 0, width: 4, height: 16 },
          bottom: { x: 6, y: 0, width: 4, height: 16 }
        }
      });

      const data = pole.stack().toJSON();
      const restored = UVRegion.from(data).free();

      assert.strictEqual(data.state === "stacked" ? data.stackedFace : null, "left");
      assert.deepStrictEqual(restored.rectFor("front"), {
        x: 0, y: 6, width: 4, height: 4
      });
      assert.deepStrictEqual(restored.rectFor("top"), {
        x: 0, y: 6, width: 4, height: 16
      });
    });

    test("omits retained faces when they all match the shared rect", () => {
      const data = new UVRegion({
        id: "c1",
        color: "#f00",
        state: "free",
        faces: {
          front: kRect,
          back: kRect,
          left: kRect,
          right: kRect,
          top: kRect,
          bottom: kRect
        }
      }).stack().toJSON();

      assert.deepStrictEqual(Object.keys(data).sort(), [
        "color", "id", "rect", "state"
      ]);
    });

    test("keeps each retained face's own size across a stack round-trip", () => {
      const ramp = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "free",
        activeFaces: ["back", "left", "right", "top", "bottom"],
        faces: {
          front: kRect,
          back: kRect,
          left: {
            shape: "triangle",
            corner: "top-right",
            rect: { x: 9, y: 9, width: 1, height: 1 }
          },
          right: { shape: "triangle", corner: "top-right", rect: kRect },
          top: kRect,
          bottom: kRect
        }
      });

      // Only the position is reset; the slot keeps the size its shape gave it.
      const smallLeft = { ...kRect, width: 1, height: 1 };
      const restored = ramp.stack().free();

      assert.deepStrictEqual(restored.rectFor("left"), smallLeft);
      assert.deepStrictEqual(restored.geometryFor("left"), {
        shape: "triangle", corner: "top-right", rect: smallLeft
      });
      assert.deepStrictEqual(restored.rectFor("back"), kRect);
    });

    test("resets moved faces onto the shared rectangle", () => {
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "free",
        faces: {
          front: kRect,
          back: kRect,
          left: kRect,
          right: kRect,
          top: kRect,
          bottom: kRect
        }
      });

      const restored = region
        .withRect({ ...kRect, x: 40, y: 30 }, "top")
        .stack()
        .free();

      for (const face of UV_FACES) {
        assert.deepStrictEqual(
          restored.rectFor(face),
          kRect,
          `${face} must restart on the region's rect`
        );
      }
    });

    test("resets moved faces when the stacked region moved too", () => {
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "free",
        faces: {
          front: kRect,
          back: kRect,
          left: kRect,
          right: kRect,
          top: kRect,
          bottom: kRect
        }
      });

      const moved = { ...kRect, x: 20, y: 10 };
      const restored = region
        .withRect({ ...kRect, x: 40, y: 30 }, "top")
        .stack()
        .withRect(moved)
        .free();

      for (const face of UV_FACES) {
        assert.deepStrictEqual(
          restored.rectFor(face),
          moved,
          `${face} must follow the region instead of replaying its old offset`
        );
      }
    });

    test("keeps each face's own size when the stacked region moved", () => {
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "free",
        faces: {
          front: { x: 0, y: 0, width: 4, height: 4 },
          back: { x: 0, y: 0, width: 4, height: 4 },
          left: { x: 0, y: 0, width: 16, height: 4 },
          right: { x: 0, y: 0, width: 16, height: 4 },
          top: { x: 0, y: 0, width: 4, height: 16 },
          bottom: { x: 0, y: 0, width: 4, height: 16 }
        }
      });

      const stacked = region.stack();
      const moved = stacked.withRect({
        ...stacked.rectFor("front"),
        x: stacked.rectFor("front").x + 20,
        y: stacked.rectFor("front").y + 10
      });
      const restored = moved.free();

      assert.deepStrictEqual(restored.rectFor("front"), {
        x: 20, y: 10, width: 4, height: 4
      });
      assert.deepStrictEqual(restored.rectFor("top"), {
        x: 20, y: 10, width: 4, height: 16
      });
    });

    test("stacks onto the largest face, not the first one", () => {
      const pole = new UVRegion({
        id: "p1",
        color: "#f00",
        state: "free",
        faces: {
          front: { x: 6, y: 6, width: 4, height: 4 },
          back: { x: 6, y: 6, width: 4, height: 4 },
          left: { x: 0, y: 6, width: 16, height: 4 },
          right: { x: 0, y: 6, width: 16, height: 4 },
          top: { x: 6, y: 0, width: 4, height: 16 },
          bottom: { x: 6, y: 0, width: 4, height: 16 }
        }
      });

      const stacked = pole.stack();

      assert.strictEqual(stacked.stackedFace, "left");
      assert.deepStrictEqual(stacked.rectFor("front"), {
        x: 0, y: 6, width: 16, height: 4
      });
    });

    test("honours an explicitly requested stack face", () => {
      const pole = new UVRegion({
        id: "p1",
        color: "#f00",
        state: "free",
        faces: {
          front: { x: 6, y: 6, width: 4, height: 4 },
          back: { x: 6, y: 6, width: 4, height: 4 },
          left: { x: 0, y: 6, width: 16, height: 4 },
          right: { x: 0, y: 6, width: 16, height: 4 },
          top: { x: 6, y: 0, width: 4, height: 16 },
          bottom: { x: 6, y: 0, width: 4, height: 16 }
        }
      });

      const stacked = pole.stack("top");

      assert.strictEqual(stacked.stackedFace, "top");
      assert.deepStrictEqual(stacked.rectFor("front"), {
        x: 6, y: 0, width: 4, height: 16
      });
    });
  });

  describe("withRect", () => {
    const nextRect: SelectionRect = { x: 7, y: 8, width: 2, height: 2 };

    test("replaces the shared rect when stacked", () => {
      const region = makeStacked().withRect(nextRect);

      assert.strictEqual(region.state, "stacked");
      assert.deepStrictEqual(region.rectFor("back"), nextRect);
    });

    test("ignores the face argument when stacked", () => {
      const region = makeStacked().withRect(nextRect, "top");

      for (const face of UV_FACES) {
        assert.deepStrictEqual(region.rectFor(face), nextRect, `${face} must follow the shared rect`);
      }
    });

    test("moves only the named face when free", () => {
      const region = makeFree().withRect(nextRect, "left");

      assert.deepStrictEqual(region.rectFor("left"), nextRect);
      for (const face of UV_FACES.filter((value) => value !== "left")) {
        assert.deepStrictEqual(region.rectFor(face), kRect, `${face} must stay put`);
      }
    });

    test("is a no-op when free and no face is given", () => {
      const region = makeFree();

      assert.strictEqual(
        region.withRect(nextRect),
        region,
        "moving every face at once is not supported yet"
      );
    });

    test("leaves the source region untouched", () => {
      const region = makeFree();
      region.withRect(nextRect, "left");

      assert.deepStrictEqual(region.rectFor("left"), kRect);
    });

    test("preserves the name through geometry and state changes", () => {
      const region = new UVRegion({
        state: "stacked",
        id: "r1",
        name: "Grass block",
        color: "#f00",
        rect: kRect
      });

      const changed = region
        .free()
        .withRect(nextRect, "front")
        .stack();

      assert.strictEqual(changed.name, "Grass block");
    });
  });

  describe("toJSON", () => {
    test("emits an explicit stacked payload", () => {
      assert.deepStrictEqual(makeStacked().toJSON(), {
        id: "r1",
        color: "#f00",
        state: "stacked",
        rect: kRect
      });
    });

    test("emits every face when free", () => {
      const data = makeFree().toJSON();

      assert.strictEqual(data.state, "free");
      assert.deepStrictEqual(
        Object.keys(data.state === "free" ? data.faces : {}).sort(),
        [...UV_FACES].sort()
      );
    });

    test("includes the optional name", () => {
      const data = new UVRegion({
        state: "stacked",
        id: "r1",
        name: "Grass block",
        color: "#f00",
        rect: kRect
      }).toJSON();

      assert.strictEqual(data.name, "Grass block");
    });

    test("round-trips through JSON", () => {
      const region = makeFree().withRect({ x: 5, y: 5, width: 1, height: 1 }, "bottom");
      const restored = UVRegion.from(
        JSON.parse(JSON.stringify(region)) as ReturnType<UVRegion["toJSON"]>
      );

      assert.strictEqual(restored.state, "free");
      for (const face of UV_FACES) {
        assert.deepStrictEqual(
          restored.rectFor(face),
          region.rectFor(face),
          `${face} must survive serialization`
        );
      }
    });

    test("returns copies the caller cannot use to mutate the region", () => {
      const region = makeStacked();
      const data = region.toJSON();
      if (data.state === "stacked") {
        data.rect.x = 99;
      }

      assert.strictEqual(region.rectFor("front").x, kRect.x);
    });
  });

  test("UV_FACES covers every UVSlot exactly once", () => {
    const faces: Record<UVSlot, true> = {
      front: true,
      back: true,
      left: true,
      right: true,
      top: true,
      bottom: true
    };

    assert.deepStrictEqual(
      [...UV_FACES].sort(),
      Object.keys(faces).sort(),
      "a face missing here would silently drop out of hit-testing and sync"
    );
  });
});
