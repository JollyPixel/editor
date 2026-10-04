// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { DEFAULT_UV_SLOTS } from "#src/uv/region/UVRegion.ts";
import { makeUvControllerSetup } from "../../helpers/uv/controller.ts";

describe("UVController — cycling through an overlapping stack", () => {
  test("a repeat click advances to the next face of the stack", () => {
    const { map, controller } = makeUvControllerSetup();
    const region = map.create({ width: 8, height: 8 });
    map.setState(region.id, "free");
    map.showAll = true;

    const picked: (string | null)[] = [];
    for (let index = 0; index < DEFAULT_UV_SLOTS.length; index++) {
      controller.handleStart({ x: 2, y: 2 });
      controller.handleEnd();
      picked.push(map.selectedSlot);
    }

    assert.deepStrictEqual(
      picked,
      [...DEFAULT_UV_SLOTS],
      "six stacked faces must each be reachable by clicking again"
    );
  });

  test("wraps back to the first face after the last one", () => {
    const { map, controller } = makeUvControllerSetup();
    const region = map.create({ width: 8, height: 8 });
    map.setState(region.id, "free");
    map.showAll = true;

    for (let index = 0; index < DEFAULT_UV_SLOTS.length; index++) {
      controller.handleStart({ x: 2, y: 2 });
      controller.handleEnd();
    }
    controller.handleStart({ x: 2, y: 2 });

    assert.strictEqual(map.selectedSlot, DEFAULT_UV_SLOTS[0]);
  });

  test("dragging a face out of the stack changes the stack, resetting the cycle", () => {
    const { map, controller } = makeUvControllerSetup();
    const region = map.create({ width: 8, height: 8 });
    map.setState(region.id, "free");
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleMove({ x: 22, y: 22 });
    controller.handleEnd();

    controller.handleStart({ x: 2, y: 2 });

    assert.strictEqual(map.selectedSlot, "back");
  });

  test("an external selection change restarts the cycle on the selected face", () => {
    const { map, controller } = makeUvControllerSetup();
    const region = map.create({ width: 8, height: 8 });
    map.setState(region.id, "free");
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleEnd();
    assert.strictEqual(map.selectedSlot, "front");

    map.select(region.id, "top");
    controller.handleStart({ x: 2, y: 2 });

    assert.strictEqual(
      map.selectedSlot,
      "top",
      "the overlay paints the selected face last, so it is the one hit first"
    );

    controller.handleEnd();
    controller.handleStart({ x: 2, y: 2 });

    assert.strictEqual(
      map.selectedSlot,
      "bottom",
      "the cycle then advances from the selected face"
    );
  });

  test("a miss resets the cycle", () => {
    const { map, controller } = makeUvControllerSetup();
    const region = map.create({ width: 8, height: 8 });
    map.setState(region.id, "free");
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleEnd();
    controller.handleStart({ x: 30, y: 30 });
    controller.handleEnd();
    map.showAll = true;
    controller.handleStart({ x: 2, y: 2 });

    assert.strictEqual(map.selectedSlot, "front");
  });

  test("dragging moves the face the cycle landed on", () => {
    const { map, controller } = makeUvControllerSetup();
    const region = map.create({ width: 8, height: 8 });
    map.setState(region.id, "free");
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleEnd();
    controller.handleStart({ x: 2, y: 2 });
    controller.handleMove({ x: 6, y: 6 });
    controller.handleEnd();

    const stored = map.get(region.id)!;
    assert.deepStrictEqual(
      stored.rectFor("back"),
      { x: 4, y: 4, width: 8, height: 8 },
      "the second click selected back, so back is what moves"
    );
    assert.deepStrictEqual(
      stored.rectFor("front"),
      { x: 0, y: 0, width: 8, height: 8 },
      "front must stay where it was"
    );
  });

  test("a face dragged over another one stays selected on the next click", () => {
    const { map, controller } = makeUvControllerSetup();
    const below = map.create({ id: "below", width: 8, height: 8 });
    const above = map.create({ id: "above", width: 8, height: 8 });
    map.showAll = true;
    map.move(below.id, { x: 0, y: 0, width: 8, height: 8 });
    map.move(above.id, { x: 16, y: 16, width: 8, height: 8 });

    controller.handleStart({ x: 20, y: 20 });
    controller.handleMove({ x: 8, y: 8 });
    controller.handleEnd();

    controller.handleStart({ x: 6, y: 6 });

    assert.strictEqual(
      map.selectedRegionId,
      "above",
      "the region painted on top wins the hit, not the one created first"
    );

    controller.handleEnd();
    controller.handleStart({ x: 6, y: 6 });

    assert.strictEqual(
      map.selectedRegionId,
      "above",
      "repeat clicks must not cycle down into a region that only overlaps"
    );
  });

  test("a partly overlapped region is unreachable under the one on top", () => {
    const { map, controller } = makeUvControllerSetup();
    map.restore({
      id: "below",
      color: "#f00",
      state: "stacked",
      rect: { x: 0, y: 0, width: 8, height: 8 }
    });
    map.restore({
      id: "above",
      color: "#0f0",
      state: "stacked",
      rect: { x: 4, y: 4, width: 8, height: 8 }
    });
    map.showAll = true;

    for (let index = 0; index < 4; index++) {
      controller.handleStart({ x: 6, y: 6 });
      controller.handleEnd();
      assert.strictEqual(map.selectedRegionId, "above");
    }

    controller.handleStart({ x: 2, y: 2 });

    assert.strictEqual(
      map.selectedRegionId,
      "below",
      "the uncovered part of the region below stays selectable"
    );
  });

  test("a stacked region is a single-entry stack, so repeat clicks keep it selected", () => {
    const { map, controller } = makeUvControllerSetup();
    const region = map.create({ width: 8, height: 8 });
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleEnd();
    controller.handleStart({ x: 2, y: 2 });

    assert.strictEqual(map.selectedRegionId, region.id);
    assert.strictEqual(map.selectedSlot, null);
  });
});
