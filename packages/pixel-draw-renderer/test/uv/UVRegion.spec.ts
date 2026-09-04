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
  type UVFace
} from "#src/uv/UVRegion.ts";
import type { SelectionRect } from "#src/types.ts";

// CONSTANTS
const kRect: SelectionRect = { x: 1, y: 2, width: 3, height: 4 };

function makeCollapsed(
  rect: SelectionRect = kRect
): UVRegion {
  return new UVRegion({ id: "r1", color: "#f00", rect });
}

function makeUncollapsed(): UVRegion {
  return makeCollapsed().uncollapse();
}

describe("UVRegion", () => {
  describe("construction", () => {
    test("defaults to collapsed when state is omitted", () => {
      const region = new UVRegion({ id: "r1", color: "#f00", rect: kRect });

      assert.strictEqual(region.state, "collapsed");
      assert.strictEqual(region.name, undefined);
      assert.deepStrictEqual(region.rectFor("front"), kRect);
    });

    test("keeps an optional name", () => {
      const region = new UVRegion({
        id: "r1",
        name: "Grass block",
        color: "#f00",
        rect: kRect
      });

      assert.strictEqual(region.name, "Grass block");
    });

    test("parses an explicit uncollapsed payload", () => {
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
        state: "uncollapsed",
        faces
      });

      assert.strictEqual(region.state, "uncollapsed");
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
      const region = new UVRegion({ id: "r1", color: "#f00", rect });
      rect.x = 99;

      assert.strictEqual(
        region.rectFor("front").x,
        kRect.x,
        "later caller mutation must not reach the region"
      );
    });

    test("from() passes an existing instance through unchanged", () => {
      const region = makeCollapsed();

      assert.strictEqual(UVRegion.from(region), region);
    });

    test("from() builds an instance out of raw data", () => {
      const region = UVRegion.from({ id: "r1", color: "#f00", rect: kRect });

      assert.ok(region instanceof UVRegion);
      assert.strictEqual(region.state, "collapsed");
    });
  });

  describe("rectFor / facesOf", () => {
    test("a collapsed region returns its single rect for every face", () => {
      const region = makeCollapsed();

      for (const face of UV_FACES) {
        assert.deepStrictEqual(region.rectFor(face), kRect, `${face} must share the rect`);
      }
    });

    test("facesOf yields one null-faced entry when collapsed", () => {
      assert.deepStrictEqual(
        makeCollapsed().facesOf(),
        [{ face: null, geometry: kRect }]
      );
    });

    test("keeps triangle geometry and its bounds separate", () => {
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "uncollapsed",
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

    test("facesOf yields six entries in UV_FACES order when uncollapsed", () => {
      const faces = makeUncollapsed().facesOf();

      assert.deepStrictEqual(
        faces.map((entry) => entry.face),
        [...UV_FACES],
        "iteration order drives hit-testing and paint order"
      );
    });

    test("normalizes active faces to UV_FACES order", () => {
      const rect = { ...kRect };
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "uncollapsed",
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
        ["left", "top"]
      );
    });

    test("geometryFor returns a copy", () => {
      const region = makeCollapsed();
      const geometry = region.geometryFor("front");
      if ("shape" in geometry) {
        assert.fail("expected rectangle geometry");
      }
      geometry.x = 99;

      assert.strictEqual(region.rectFor("front").x, kRect.x);
    });

    test("rectFor returns a copy", () => {
      const region = makeCollapsed();
      const rect = region.rectFor("front");
      rect.x = 99;

      assert.strictEqual(region.rectFor("front").x, kRect.x);
    });

    test("facesOf returns geometry copies", () => {
      const region = makeUncollapsed();
      const [{ geometry }] = region.facesOf();
      if ("shape" in geometry) {
        assert.fail("expected rectangle geometry");
      }
      geometry.x = 99;

      assert.strictEqual(region.rectFor("front").x, kRect.x);
    });
  });

  describe("uncollapse", () => {
    test("gives every face the current rect, so the mesh does not change", () => {
      const region = makeUncollapsed();

      assert.strictEqual(region.state, "uncollapsed");
      for (const face of UV_FACES) {
        assert.deepStrictEqual(region.rectFor(face), kRect, `${face} must start where the region was`);
      }
    });

    test("gives each face an independent rect object", () => {
      const region = makeUncollapsed();

      assert.notStrictEqual(
        region.rectFor("front"),
        region.rectFor("top"),
        "faces must not share one object, or moving one would move all"
      );
    });

    test("returns the same instance when already uncollapsed", () => {
      const region = makeUncollapsed();

      assert.strictEqual(region.uncollapse(), region);
    });

    test("leaves the source region untouched", () => {
      const region = makeCollapsed();
      region.uncollapse();

      assert.strictEqual(region.state, "collapsed");
    });
  });

  describe("collapse", () => {
    test("keeps the front face by default", () => {
      const moved = makeUncollapsed().withRect({ x: 9, y: 9, width: 1, height: 1 }, "top");
      const collapsed = moved.collapse();

      assert.strictEqual(collapsed.state, "collapsed");
      assert.deepStrictEqual(collapsed.rectFor("front"), kRect);
    });

    test("uses the requested face as the shared rectangle", () => {
      const topRect = { x: 9, y: 9, width: 1, height: 1 };
      const collapsed = makeUncollapsed()
        .withRect(topRect, "top")
        .collapse("top");

      for (const face of UV_FACES) {
        assert.deepStrictEqual(
          collapsed.rectFor(face),
          topRect,
          `${face} must adopt the surviving rect`
        );
      }
    });

    test("returns the same instance when already collapsed", () => {
      const region = makeCollapsed();

      assert.strictEqual(region.collapse(), region);
    });

    test("prefers a rectangle when collapsing a mixed region", () => {
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "uncollapsed",
        activeFaces: ["left", "top"],
        faces: {
          front: kRect,
          back: kRect,
          left: { shape: "triangle", corner: "top-right", rect: kRect },
          right: kRect,
          top: { x: 9, y: 9, width: 1, height: 1 },
          bottom: kRect
        }
      });

      assert.deepStrictEqual(region.collapse("left").rectFor("front"), {
        x: 9, y: 9, width: 1, height: 1
      });
    });

    test("restores triangle topology after collapsing and uncollapsing", () => {
      const ramp = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "uncollapsed",
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

      const restored = ramp.collapse().uncollapse();

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
        state: "uncollapsed",
        faces: {
          front: { x: 6, y: 6, width: 4, height: 4 },
          back: { x: 6, y: 6, width: 4, height: 4 },
          left: { x: 0, y: 6, width: 16, height: 4 },
          right: { x: 0, y: 6, width: 16, height: 4 },
          top: { x: 6, y: 0, width: 4, height: 16 },
          bottom: { x: 6, y: 0, width: 4, height: 16 }
        }
      });

      const data = pole.collapse().toJSON();
      const restored = UVRegion.from(data).uncollapse();

      assert.strictEqual(data.collapsedFace, "left");
      assert.deepStrictEqual(restored.rectFor("front"), {
        x: 6, y: 6, width: 4, height: 4
      });
      assert.deepStrictEqual(restored.rectFor("top"), {
        x: 6, y: 0, width: 4, height: 16
      });
    });

    test("omits retained faces when they all match the shared rect", () => {
      const data = new UVRegion({
        id: "c1",
        color: "#f00",
        state: "uncollapsed",
        faces: {
          front: kRect,
          back: kRect,
          left: kRect,
          right: kRect,
          top: kRect,
          bottom: kRect
        }
      }).collapse().toJSON();

      assert.deepStrictEqual(Object.keys(data).sort(), [
        "color", "id", "rect", "state"
      ]);
    });

    test("keeps each retained face's own bounds across a collapse round-trip", () => {
      const ramp = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "uncollapsed",
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

      const smallLeft = { x: 9, y: 9, width: 1, height: 1 };
      const restored = ramp.collapse().uncollapse();

      assert.deepStrictEqual(restored.rectFor("left"), smallLeft);
      assert.deepStrictEqual(restored.geometryFor("left"), {
        shape: "triangle", corner: "top-right", rect: smallLeft
      });
      assert.deepStrictEqual(restored.rectFor("back"), kRect);
    });

    test("translates retained faces when the collapsed region moved", () => {
      const region = new UVRegion({
        id: "r1",
        color: "#f00",
        state: "uncollapsed",
        faces: {
          front: { x: 0, y: 0, width: 4, height: 4 },
          back: { x: 0, y: 0, width: 4, height: 4 },
          left: { x: 0, y: 0, width: 16, height: 4 },
          right: { x: 0, y: 0, width: 16, height: 4 },
          top: { x: 0, y: 0, width: 4, height: 16 },
          bottom: { x: 0, y: 0, width: 4, height: 16 }
        }
      });

      const collapsed = region.collapse();
      const moved = collapsed.withRect({
        ...collapsed.rectFor("front"),
        x: collapsed.rectFor("front").x + 20,
        y: collapsed.rectFor("front").y + 10
      });
      const restored = moved.uncollapse();

      assert.deepStrictEqual(restored.rectFor("front"), {
        x: 20, y: 10, width: 4, height: 4
      });
      assert.deepStrictEqual(restored.rectFor("top"), {
        x: 20, y: 10, width: 4, height: 16
      });
    });

    test("collapses onto the largest face, not the first one", () => {
      const pole = new UVRegion({
        id: "p1",
        color: "#f00",
        state: "uncollapsed",
        faces: {
          front: { x: 6, y: 6, width: 4, height: 4 },
          back: { x: 6, y: 6, width: 4, height: 4 },
          left: { x: 0, y: 6, width: 16, height: 4 },
          right: { x: 0, y: 6, width: 16, height: 4 },
          top: { x: 6, y: 0, width: 4, height: 16 },
          bottom: { x: 6, y: 0, width: 4, height: 16 }
        }
      });

      const collapsed = pole.collapse();

      assert.strictEqual(collapsed.collapsedFace, "left");
      assert.deepStrictEqual(collapsed.rectFor("front"), {
        x: 0, y: 6, width: 16, height: 4
      });
    });

    test("honours an explicitly requested collapse face", () => {
      const pole = new UVRegion({
        id: "p1",
        color: "#f00",
        state: "uncollapsed",
        faces: {
          front: { x: 6, y: 6, width: 4, height: 4 },
          back: { x: 6, y: 6, width: 4, height: 4 },
          left: { x: 0, y: 6, width: 16, height: 4 },
          right: { x: 0, y: 6, width: 16, height: 4 },
          top: { x: 6, y: 0, width: 4, height: 16 },
          bottom: { x: 6, y: 0, width: 4, height: 16 }
        }
      });

      const collapsed = pole.collapse("top");

      assert.strictEqual(collapsed.collapsedFace, "top");
      assert.deepStrictEqual(collapsed.rectFor("front"), {
        x: 6, y: 0, width: 4, height: 16
      });
    });
  });

  describe("withRect", () => {
    const nextRect: SelectionRect = { x: 7, y: 8, width: 2, height: 2 };

    test("replaces the shared rect when collapsed", () => {
      const region = makeCollapsed().withRect(nextRect);

      assert.strictEqual(region.state, "collapsed");
      assert.deepStrictEqual(region.rectFor("back"), nextRect);
    });

    test("ignores the face argument when collapsed", () => {
      const region = makeCollapsed().withRect(nextRect, "top");

      for (const face of UV_FACES) {
        assert.deepStrictEqual(region.rectFor(face), nextRect, `${face} must follow the shared rect`);
      }
    });

    test("moves only the named face when uncollapsed", () => {
      const region = makeUncollapsed().withRect(nextRect, "left");

      assert.deepStrictEqual(region.rectFor("left"), nextRect);
      for (const face of UV_FACES.filter((value) => value !== "left")) {
        assert.deepStrictEqual(region.rectFor(face), kRect, `${face} must stay put`);
      }
    });

    test("is a no-op when uncollapsed and no face is given", () => {
      const region = makeUncollapsed();

      assert.strictEqual(
        region.withRect(nextRect),
        region,
        "moving every face at once is not supported yet"
      );
    });

    test("leaves the source region untouched", () => {
      const region = makeUncollapsed();
      region.withRect(nextRect, "left");

      assert.deepStrictEqual(region.rectFor("left"), kRect);
    });

    test("preserves the name through geometry and state changes", () => {
      const region = new UVRegion({
        id: "r1",
        name: "Grass block",
        color: "#f00",
        rect: kRect
      });

      const changed = region
        .uncollapse()
        .withRect(nextRect, "front")
        .collapse();

      assert.strictEqual(changed.name, "Grass block");
    });
  });

  describe("toJSON", () => {
    test("emits an explicit collapsed payload", () => {
      assert.deepStrictEqual(makeCollapsed().toJSON(), {
        id: "r1",
        color: "#f00",
        state: "collapsed",
        rect: kRect
      });
    });

    test("emits every face when uncollapsed", () => {
      const data = makeUncollapsed().toJSON();

      assert.strictEqual(data.state, "uncollapsed");
      assert.deepStrictEqual(
        Object.keys(data.state === "uncollapsed" ? data.faces : {}).sort(),
        [...UV_FACES].sort()
      );
    });

    test("includes the optional name", () => {
      const data = new UVRegion({
        id: "r1",
        name: "Grass block",
        color: "#f00",
        rect: kRect
      }).toJSON();

      assert.strictEqual(data.name, "Grass block");
    });

    test("round-trips through JSON", () => {
      const region = makeUncollapsed().withRect({ x: 5, y: 5, width: 1, height: 1 }, "bottom");
      const restored = UVRegion.from(
        JSON.parse(JSON.stringify(region)) as ReturnType<UVRegion["toJSON"]>
      );

      assert.strictEqual(restored.state, "uncollapsed");
      for (const face of UV_FACES) {
        assert.deepStrictEqual(
          restored.rectFor(face),
          region.rectFor(face),
          `${face} must survive serialization`
        );
      }
    });

    test("returns copies the caller cannot use to mutate the region", () => {
      const region = makeCollapsed();
      const data = region.toJSON();
      if (data.state !== "uncollapsed") {
        data.rect.x = 99;
      }

      assert.strictEqual(region.rectFor("front").x, kRect.x);
    });
  });

  test("UV_FACES covers every UVFace exactly once", () => {
    const faces: Record<UVFace, true> = {
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
