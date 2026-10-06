// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { EventPayload } from "../../helpers/uv/map.ts";
import {
  makeUvControllerSetup,
  type UVControllerSetup
} from "../../helpers/uv/controller.ts";
import type { Vec2 } from "#src/types.ts";

// CONSTANTS
const kOuter = {
  x: 4,
  y: 4,
  width: 8,
  height: 8
};
const kInner = {
  x: 6,
  y: 6,
  width: 2,
  height: 2
};

function nestedSetup(
  size?: Vec2
): UVControllerSetup {
  const setup = makeUvControllerSetup(size);
  const { map } = setup;
  for (const [id, rect] of [["outer", kOuter], ["inner", kInner]] as const) {
    map.create({
      id,
      width: rect.width,
      height: rect.height
    });
    map.move(id, rect);
  }
  map.showAll = true;
  map.select("outer");

  return setup;
}

describe("UVController — carrying nested regions", () => {
  test("a drag without carry leaves the nested region in place", () => {
    const { map, controller } = nestedSetup();

    controller.handleStart({ x: 5, y: 5 });
    controller.handleMove({ x: 9, y: 7 });
    controller.handleEnd();

    assert.deepStrictEqual(map.get("outer")!.bounds, { ...kOuter, x: 8, y: 6 });
    assert.deepStrictEqual(map.get("inner")!.bounds, kInner);
  });

  test("a carrying drag moves the nested region by the same delta", () => {
    const { map, controller, overlay } = nestedSetup();
    controller.lineHeld = true;

    controller.handleStart({ x: 5, y: 5 });
    controller.handleMove({ x: 9, y: 7 });

    assert.deepStrictEqual(
      overlay.previews.at(-1)?.regions.map((region) => region.bounds),
      [{ ...kOuter, x: 8, y: 6 }, { ...kInner, x: 10, y: 8 }]
    );

    controller.handleEnd();

    assert.deepStrictEqual(map.get("outer")!.bounds, { ...kOuter, x: 8, y: 6 });
    assert.deepStrictEqual(map.get("inner")!.bounds, { ...kInner, x: 10, y: 8 });
  });

  test("the nested region follows the dragged region's clamped delta", () => {
    const { map, controller } = nestedSetup({ x: 16, y: 16 });
    controller.lineHeld = true;

    controller.handleStart({ x: 5, y: 5 });
    controller.handleMove({ x: 50, y: 5 });
    controller.handleEnd();

    assert.deepStrictEqual(map.get("outer")!.bounds, { ...kOuter, x: 8 });
    assert.deepStrictEqual(map.get("inner")!.bounds, { ...kInner, x: 10 });
  });

  test("releasing carry mid-drag puts the nested region back and leaves it on commit", () => {
    const { map, controller, overlay } = nestedSetup();
    const dragged: EventPayload<"region-dragging">[] = [];
    map.on("region-dragging", (event) => dragged.push(event));

    controller.handleStart({ x: 5, y: 5 });
    controller.handleMove({ x: 9, y: 7 });
    controller.lineHeld = true;
    controller.lineHeld = false;

    assert.deepStrictEqual(
      overlay.previews.at(-1)?.regions.map((region) => region.bounds),
      [{ ...kOuter, x: 8, y: 6 }, kInner]
    );
    assert.deepStrictEqual(
      dragged
        .filter(({ region }) => region.id === "inner")
        .map(({ region }) => region.bounds),
      [{ ...kInner, x: 10, y: 8 }, kInner]
    );

    controller.handleEnd();

    assert.deepStrictEqual(map.get("outer")!.bounds, { ...kOuter, x: 8, y: 6 });
    assert.deepStrictEqual(map.get("inner")!.bounds, kInner);
  });

  test("cancelDrag reverts the carried preview", () => {
    const { map, controller } = nestedSetup();
    const dragged: EventPayload<"region-dragging">[] = [];
    map.on("region-dragging", (event) => dragged.push(event));
    controller.lineHeld = true;

    controller.handleStart({ x: 5, y: 5 });
    controller.handleMove({ x: 9, y: 7 });
    controller.cancelDrag();

    assert.deepStrictEqual(
      dragged.at(-1)?.region.bounds,
      kInner
    );
    assert.deepStrictEqual(map.get("inner")!.bounds, kInner);
    assert.deepStrictEqual(map.get("outer")!.bounds, kOuter);
  });

  test("dragging the nested region never carries the one around it", () => {
    const { map, controller } = nestedSetup();
    map.select("inner");
    controller.lineHeld = true;

    controller.handleStart({ x: 6, y: 6 });
    controller.handleMove({ x: 7, y: 6 });
    controller.handleEnd();

    assert.deepStrictEqual(map.get("inner")!.bounds, { ...kInner, x: 7 });
    assert.deepStrictEqual(map.get("outer")!.bounds, kOuter);
  });

  test("a free slot carries the sibling slots nested in it", () => {
    const { map, controller } = makeUvControllerSetup();
    map.create({
      id: "free",
      width: kOuter.width,
      height: kOuter.height,
      activeSlots: ["front", "top"],
      state: "free"
    });
    map.move("free", kOuter, "front");
    map.resize("free", kInner, "top");
    map.showAll = true;
    map.select("free", "front");
    controller.lineHeld = true;

    controller.handleStart({ x: 5, y: 5 });
    controller.handleMove({ x: 9, y: 7 });
    controller.handleEnd();

    const free = map.get("free")!;
    assert.deepStrictEqual(free.rectFor("front"), { ...kOuter, x: 8, y: 6 });
    assert.deepStrictEqual(free.rectFor("top"), { ...kInner, x: 10, y: 8 });
  });
});
