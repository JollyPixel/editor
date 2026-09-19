// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  copyGeometry,
  geometryAt,
  rectOf,
  rotateCorner,
  rotateGeometry,
  rotateUv
} from "#src/uv/geometry.ts";
import {
  UVRegion,
  type UVGeometry,
  type UVRegionData
} from "#src/uv/UVRegion.ts";
import { isUVGeometry, isUVRegionData } from "#src/uv/validation.ts";
import { makeMap, type EventPayload } from "../helpers/uv-map.ts";

function turned(
  geometry: UVGeometry,
  times: number
): UVGeometry {
  let result = geometry;
  for (let index = 0; index < times; index++) {
    result = rotateGeometry(result, 1);
  }

  return result;
}

function unfoldedPair(): UVRegion {
  return new UVRegion({
    id: "net",
    color: "#f00",
    state: "unfolded",
    faces: {
      front: { x: 0, y: 0, width: 16, height: 8 },
      top: { x: 16, y: 0, width: 8, height: 8 }
    }
  });
}

function freeRegion(
  faces: UVRegionData & { state: "free"; }
): UVRegion {
  return new UVRegion(faces);
}

describe("UV rotation geometry", () => {
  test("a rect keeps its top-left corner and swaps its size", () => {
    const rotated = rotateGeometry({ x: 2, y: 3, width: 16, height: 8 }, 1);

    assert.deepStrictEqual(rotated, {
      x: 2,
      y: 3,
      width: 8,
      height: 16,
      rotation: 1
    });
  });

  test("negative turns wrap to the matching clockwise rotation", () => {
    const rotated = rotateGeometry({ x: 0, y: 0, width: 4, height: 2 }, -1);

    assert.strictEqual(rotated.rotation, 3);
    assert.deepStrictEqual(rectOf(rotated), { x: 0, y: 0, width: 2, height: 4 });
  });

  test("four turns restore every geometry kind and drop the rotation field", () => {
    const geometries: UVGeometry[] = [
      { x: 1, y: 2, width: 16, height: 8 },
      {
        shape: "triangle",
        corner: "bottom-right",
        rect: { x: 0, y: 0, width: 16, height: 23 }
      },
      {
        shape: "compound",
        rect: { x: 0, y: 0, width: 16, height: 16 },
        parts: [
          { x: 0, y: 0.5, width: 1, height: 0.5 },
          {
            shape: "triangle",
            corner: "top-left",
            rect: { x: 0, y: 0, width: 0.5, height: 0.5 }
          }
        ]
      }
    ];

    for (const geometry of geometries) {
      assert.deepStrictEqual(turned(geometry, 4), geometry);
    }
  });

  test("triangle corners turn clockwise", () => {
    assert.strictEqual(rotateCorner("top-left", 1), "top-right");
    assert.strictEqual(rotateCorner("top-right", 1), "bottom-right");
    assert.strictEqual(rotateCorner("bottom-right", 1), "bottom-left");
    assert.strictEqual(rotateCorner("bottom-left", 1), "top-left");
    assert.strictEqual(rotateCorner("top-left", -1), "bottom-left");
  });

  test("compound parts turn inside the unit square", () => {
    const rotated = rotateGeometry({
      shape: "compound",
      rect: { x: 0, y: 0, width: 16, height: 8 },
      parts: [
        { x: 0, y: 0, width: 0.5, height: 1 },
        {
          shape: "triangle",
          corner: "bottom-right",
          rect: { x: 0.5, y: 0, width: 0.5, height: 1 }
        }
      ]
    }, 1);

    assert.deepStrictEqual(rotated, {
      shape: "compound",
      rect: { x: 0, y: 0, width: 8, height: 16 },
      parts: [
        { x: 0, y: 0, width: 1, height: 0.5 },
        {
          shape: "triangle",
          corner: "bottom-left",
          rect: { x: 0, y: 0.5, width: 1, height: 0.5 }
        }
      ],
      rotation: 1
    });
  });

  test("rotateUv sends the face top edge to the rect right edge on a clockwise turn", () => {
    assert.deepStrictEqual(rotateUv(0, 1, 1), [1, 1]);
    assert.deepStrictEqual(rotateUv(1, 1, 1), [1, 0]);
    assert.deepStrictEqual(rotateUv(0, 0, 1), [0, 1]);
    assert.deepStrictEqual(rotateUv(0.25, 0.75, 4), [0.25, 0.75]);
    assert.deepStrictEqual(rotateUv(0, 1, -1), rotateUv(0, 1, 3));
  });

  test("copies and moves keep the rotation, rectOf drops it", () => {
    const geometry: UVGeometry = { x: 0, y: 0, width: 4, height: 8, rotation: 3 };

    assert.deepStrictEqual(copyGeometry(geometry), geometry);
    assert.deepStrictEqual(
      geometryAt(geometry, { x: 5, y: 6, width: 4, height: 8 }),
      { x: 5, y: 6, width: 4, height: 8, rotation: 3 }
    );
    assert.deepStrictEqual(rectOf(geometry), { x: 0, y: 0, width: 4, height: 8 });
  });

  test("validation accepts quarter turns only", () => {
    const rect = { x: 0, y: 0, width: 4, height: 4 };

    assert.ok(isUVGeometry({ ...rect, rotation: 2 }));
    assert.ok(!isUVGeometry({ ...rect, rotation: 4 }));
    assert.ok(!isUVGeometry({ ...rect, rotation: 1.5 }));
    assert.ok(isUVRegionData({
      id: "a",
      color: "#f00",
      state: "stacked",
      rect: { ...rect, rotation: 1 }
    }));
    assert.ok(!isUVRegionData({
      id: "a",
      color: "#f00",
      state: "stacked",
      rect: { ...rect, rotation: -1 }
    }));
  });
});

describe("UVRegion.rotated", () => {
  test("a stacked region rotates its shared rect and every slot", () => {
    const region = new UVRegion({
      id: "a",
      color: "#f00",
      state: "stacked",
      rect: { x: 0, y: 0, width: 16, height: 8 }
    });

    const rotated = region.rotated("cw");

    assert.deepStrictEqual(rotated.bounds, { x: 0, y: 0, width: 8, height: 16 });
    for (const slot of rotated.slots) {
      assert.strictEqual(rotated.geometryFor(slot).rotation, 1);
    }
    assert.deepStrictEqual(rotated.toJSON(), {
      id: "a",
      color: "#f00",
      state: "stacked",
      rect: { x: 0, y: 0, width: 8, height: 16, rotation: 1 }
    });
    assert.deepStrictEqual(
      new UVRegion(rotated.toJSON()).toJSON(),
      rotated.toJSON()
    );
  });

  test("a stacked rotation survives free and unfold", () => {
    const rotated = new UVRegion({
      id: "a",
      color: "#f00",
      state: "stacked",
      rect: { x: 0, y: 0, width: 16, height: 8 }
    }).rotated("ccw");

    for (const region of [rotated.free(), rotated.unfold()]) {
      for (const slot of region.activeSlots) {
        assert.strictEqual(region.geometryFor(slot).rotation, 3);
        assert.strictEqual(rectOf(region.geometryFor(slot)).width, 8);
      }
    }
  });

  test("an unfolded net turns as one piece around its bounds", () => {
    const rotated = unfoldedPair().rotated("cw");

    assert.deepStrictEqual(rotated.geometryFor("front"), {
      x: 0,
      y: 0,
      width: 8,
      height: 16,
      rotation: 1
    });
    assert.deepStrictEqual(rotated.geometryFor("top"), {
      x: 0,
      y: 16,
      width: 8,
      height: 8,
      rotation: 1
    });
    assert.deepStrictEqual(rotated.bounds, { x: 0, y: 0, width: 8, height: 24 });
  });

  test("clockwise then counter-clockwise restores an unfolded net", () => {
    const region = unfoldedPair();

    assert.deepStrictEqual(
      region.rotated("cw").rotated("ccw").toJSON(),
      region.toJSON()
    );
    assert.deepStrictEqual(
      region
        .rotated("cw")
        .rotated("cw")
        .rotated("cw")
        .rotated("cw")
        .toJSON(),
      region.toJSON()
    );
  });

  test("a free region rotates only the given slot in place", () => {
    const region = freeRegion({
      id: "a",
      color: "#f00",
      state: "free",
      faces: {
        front: { x: 4, y: 4, width: 16, height: 8 },
        top: { x: 0, y: 20, width: 16, height: 8 }
      }
    });

    const rotated = region.rotated("cw", "front");

    assert.deepStrictEqual(rotated.geometryFor("front"), {
      x: 4,
      y: 4,
      width: 8,
      height: 16,
      rotation: 1
    });
    assert.deepStrictEqual(rotated.geometryFor("top"), region.geometryFor("top"));
    assert.strictEqual(region.rotated("cw"), region);
    assert.strictEqual(region.rotated("cw", "unknown"), region);
  });

  test("moving a rotated free slot keeps its rotation", () => {
    const region = freeRegion({
      id: "a",
      color: "#f00",
      state: "free",
      faces: {
        front: { x: 0, y: 0, width: 4, height: 8, rotation: 1 }
      }
    });

    const moved = region.withRect({ x: 10, y: 10, width: 4, height: 8 }, "front");

    assert.strictEqual(moved.geometryFor("front").rotation, 1);
  });

  test("withGeometry replaces one free slot and ignores other states", () => {
    const region = freeRegion({
      id: "a",
      color: "#f00",
      state: "free",
      faces: {
        front: { x: 0, y: 0, width: 4, height: 8 }
      }
    });
    const geometry: UVGeometry = { x: 0, y: 0, width: 8, height: 4, rotation: 1 };

    assert.deepStrictEqual(
      region.withGeometry("front", geometry).geometryFor("front"),
      geometry
    );
    assert.strictEqual(region.withGeometry("top", geometry), region);
    assert.strictEqual(unfoldedPair().withGeometry("front", geometry).state, "unfolded");
  });
});

describe("UVRegion.stack rotation", () => {
  test("stacking adopts the most common rotation among the active slots", () => {
    const region = freeRegion({
      id: "a",
      color: "#f00",
      state: "free",
      faces: {
        front: { x: 0, y: 0, width: 8, height: 8, rotation: 1 },
        back: { x: 8, y: 0, width: 8, height: 8, rotation: 1 },
        top: { x: 16, y: 0, width: 8, height: 8 }
      }
    });

    const stacked = region.stack();

    assert.strictEqual(stacked.geometryFor("top").rotation, 1);
    assert.strictEqual(stacked.free().geometryFor("top").rotation, 1);
  });

  test("a tie keeps the rotation of the slot being stacked on", () => {
    const region = freeRegion({
      id: "a",
      color: "#f00",
      state: "free",
      faces: {
        front: { x: 0, y: 0, width: 8, height: 8, rotation: 1 },
        top: { x: 16, y: 0, width: 8, height: 8 }
      }
    });

    assert.strictEqual(region.stack("top").geometryFor("front").rotation, undefined);
    assert.strictEqual(region.stack("front").geometryFor("top").rotation, 1);
  });

  test("an outvoted stack target turns back to the dominant rotation", () => {
    const region = freeRegion({
      id: "a",
      color: "#f00",
      state: "free",
      faces: {
        front: { x: 0, y: 0, width: 8, height: 16, rotation: 1 },
        back: { x: 8, y: 0, width: 16, height: 8 },
        top: { x: 24, y: 0, width: 16, height: 8 }
      }
    });

    const stacked = region.stack("front");

    assert.deepStrictEqual(stacked.geometryFor("front"), {
      x: 0,
      y: 0,
      width: 16,
      height: 8
    });
    assert.deepStrictEqual(
      stacked.free().geometryFor("front"),
      { x: 0, y: 0, width: 16, height: 8 }
    );
  });
});

describe("UVMap.rotate", () => {
  test("rotates a stacked region and emits region-rotated", () => {
    const map = makeMap();
    const region = map.create({ width: 16, height: 8 });
    const rotated: EventPayload<"region-rotated">[] = [];
    const stateChanged: unknown[] = [];
    map.on("region-rotated", (event) => rotated.push(event));
    map.on("region-state-changed", (event) => stateChanged.push(event));

    assert.ok(map.rotate(region.id, "cw"));

    assert.strictEqual(rotated.length, 1);
    assert.strictEqual(rotated[0].face, null);
    assert.strictEqual(rotated[0].region, map.get(region.id));
    assert.deepStrictEqual(rotated[0].previous, region.toJSON());
    assert.strictEqual(stateChanged.length, 0);
  });

  test("clamps a rotated region back inside the canvas", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 16 });
    map.move(region.id, { x: 28, y: 0, width: 4, height: 16 });

    map.rotate(region.id, "cw");

    assert.deepStrictEqual(
      map.get(region.id)!.bounds,
      { x: 16, y: 0, width: 16, height: 4 }
    );
  });

  test("a free region needs a slot and clamps only that slot", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 16 });
    map.setState(region.id, "free");
    map.move(region.id, { x: 28, y: 0, width: 4, height: 16 }, "top");
    const events: EventPayload<"region-rotated">[] = [];
    map.on("region-rotated", (event) => events.push(event));

    assert.ok(!map.rotate(region.id, "cw"));
    assert.ok(map.rotate(region.id, "cw", "top"));

    const stored = map.get(region.id)!;
    assert.deepStrictEqual(
      stored.geometryFor("top"),
      { x: 16, y: 0, width: 16, height: 4, rotation: 1 }
    );
    assert.deepStrictEqual(stored.rectFor("front"), region.rectFor("front"));
    assert.strictEqual(events[0].face, "top");
  });

  test("returns false for an unknown region", () => {
    assert.ok(!makeMap().rotate("missing", "cw"));
  });

  test("restoreRotation replaces the region and reports the rotated face", () => {
    const map = makeMap();
    const region = map.create({ width: 4, height: 4 });
    const events: EventPayload<"region-rotated">[] = [];
    map.on("region-rotated", (event) => events.push(event));

    assert.ok(map.restoreRotation(region.rotated("cw").toJSON()));

    assert.strictEqual(map.get(region.id)!.geometryFor("front").rotation, 1);
    assert.strictEqual(events[0].face, null);
  });

  test("moves keep the current size and rotation", () => {
    const map = makeMap();
    const region = map.create({ width: 16, height: 8 });
    map.rotate(region.id, "cw");
    const dragged: EventPayload<"region-dragging">[] = [];
    map.on("region-dragging", (event) => dragged.push(event));

    map.previewMove(region.id, { x: 2, y: 2, width: 16, height: 8 });
    map.move(region.id, { x: 4, y: 4, width: 16, height: 8 });

    assert.deepStrictEqual(dragged[0].rect, { x: 2, y: 2, width: 8, height: 16 });
    assert.strictEqual(dragged[0].geometry.rotation, 1);
    assert.deepStrictEqual(
      map.get(region.id)!.geometryFor("front"),
      { x: 4, y: 4, width: 8, height: 16, rotation: 1 }
    );
  });
});
