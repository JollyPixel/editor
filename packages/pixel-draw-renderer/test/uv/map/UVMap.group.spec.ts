// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVMap } from "#src/uv/map/UVMap.ts";
import type { UVRegionState } from "#src/uv/region/UVRegion.ts";
import type { SelectionRect } from "#src/types.ts";
import {
  makeUvMap,
  type EventPayload
} from "../../helpers/uv/map.ts";

// CONSTANTS
const kOuter: SelectionRect = {
  x: 4,
  y: 4,
  width: 8,
  height: 8
};

function place(
  map: UVMap,
  id: string,
  rect: SelectionRect,
  state: UVRegionState = "stacked"
): void {
  map.create({
    id,
    width: rect.width,
    height: rect.height,
    state
  });
  map.move(id, rect);
}

describe("UVMap — targetsWithin", () => {
  for (const { name, rect, nested } of [
    {
      name: "a region strictly inside",
      rect: { x: 6, y: 6, width: 2, height: 2 },
      nested: true
    },
    {
      name: "a region on the inner edges",
      rect: { x: 4, y: 10, width: 8, height: 2 },
      nested: true
    },
    {
      name: "a region with the same rect",
      rect: kOuter,
      nested: true
    },
    {
      name: "a region crossing an edge",
      rect: { x: 10, y: 6, width: 4, height: 2 },
      nested: false
    },
    {
      name: "a region outside",
      rect: { x: 20, y: 20, width: 2, height: 2 },
      nested: false
    }
  ]) {
    test(`${nested ? "includes" : "excludes"} ${name}`, () => {
      const map = makeUvMap();
      map.showAll = true;
      place(map, "outer", kOuter);
      place(map, "inner", rect);

      assert.deepStrictEqual(
        map.targetsWithin(kOuter),
        [
          { id: "outer", rect: kOuter, slot: null },
          ...nested ? [{ id: "inner", rect, slot: null }] : []
        ]
      );
    });
  }

  test("excludes hidden regions", () => {
    const map = makeUvMap();
    place(map, "outer", kOuter);
    place(map, "inner", { x: 6, y: 6, width: 2, height: 2 });
    map.select("outer");

    assert.deepStrictEqual(
      map.targetsWithin(kOuter),
      [{ id: "outer", rect: kOuter, slot: null }]
    );
  });

  test("lists each slot of a free region on its own", () => {
    const map = makeUvMap();
    map.showAll = true;
    map.create({
      id: "free",
      width: 2,
      height: 2,
      activeSlots: ["front", "back", "top"],
      state: "free"
    });
    const front = { x: 6, y: 6, width: 2, height: 2 };
    const top = { x: 8, y: 8, width: 2, height: 2 };
    map.move("free", front, "front");
    map.move("free", { x: 20, y: 20, width: 2, height: 2 }, "back");
    map.move("free", top, "top");

    assert.deepStrictEqual(
      map.targetsWithin(kOuter),
      [
        { id: "free", rect: front, slot: "front" },
        { id: "free", rect: top, slot: "top" }
      ]
    );
  });

  test("an unfolded region is one target, by its net bounds", () => {
    const map = makeUvMap({ x: 64, y: 64 });
    map.showAll = true;
    map.create({
      id: "net",
      width: 2,
      height: 2,
      activeSlots: ["front", "back", "top", "bottom"],
      state: "unfolded"
    });
    const net = map.get("net")!.bounds;

    assert.deepStrictEqual(
      map.targetsWithin(net),
      [{ id: "net", rect: net, slot: null }]
    );
    assert.deepStrictEqual(
      map.targetsWithin({ ...net, width: net.width - 1 }),
      []
    );
  });
});

describe("UVMap — moveGroup", () => {
  test("moves every target inside one batch and emits region-moved for each", () => {
    const batches: number[] = [];
    let moves = 0;
    const map = new UVMap({
      getCanvasSize: () => {
        return { x: 32, y: 32 };
      },
      batch: (apply) => {
        const before = moves;
        apply();
        batches.push(moves - before);
      }
    });
    place(map, "outer", kOuter);
    place(map, "inner", { x: 6, y: 6, width: 2, height: 2 });
    map.on("region-moved", () => moves++);

    const moved = map.moveGroup([
      { id: "outer", rect: { ...kOuter, x: 10 }, slot: null },
      { id: "inner", rect: { x: 12, y: 6, width: 2, height: 2 }, slot: null }
    ]);

    assert.ok(moved);
    assert.deepStrictEqual(batches, [2]);
    assert.deepStrictEqual(map.get("outer")!.bounds, { ...kOuter, x: 10 });
    assert.deepStrictEqual(map.get("inner")!.bounds, { x: 12, y: 6, width: 2, height: 2 });
  });

  test("returns false when no move applies", () => {
    const map = makeUvMap();

    assert.ok(!map.moveGroup([
      { id: "missing", rect: kOuter, slot: null }
    ]));
  });
});

describe("UVMap — previewMoveGroup", () => {
  test("folds moves of one region into a single preview without storing it", () => {
    const map = makeUvMap();
    map.create({
      id: "free",
      width: 4,
      height: 4,
      activeSlots: ["front", "back"],
      state: "free"
    });
    const stored = map.get("free")!;
    const events: EventPayload<"region-dragging">[] = [];
    map.on("region-dragging", (event) => events.push(event));

    const [preview, ...rest] = map.previewMoveGroup([
      { id: "free", rect: { x: 10, y: 0, width: 4, height: 4 }, slot: "front" },
      { id: "free", rect: { x: 0, y: 10, width: 4, height: 4 }, slot: "back" }
    ]);

    assert.deepStrictEqual(rest, []);
    assert.deepStrictEqual(preview.rectFor("front"), { x: 10, y: 0, width: 4, height: 4 });
    assert.deepStrictEqual(preview.rectFor("back"), { x: 0, y: 10, width: 4, height: 4 });
    assert.deepStrictEqual(
      events.map(({ region, face }) => [region, face]),
      [[preview, null]]
    );
    assert.strictEqual(map.get("free"), stored);
  });
});
