// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { EventPayload } from "../../helpers/uv/map.ts";
import { makeUvControllerSetup } from "../../helpers/uv/controller.ts";

describe("UVController — drag to move", () => {
  test("commits the accumulated delta on handleEnd", () => {
    const { map, controller } = makeUvControllerSetup();
    const region = map.create({ width: 8, height: 8 });
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleMove({ x: 6, y: 6 });
    controller.handleEnd();

    assert.deepStrictEqual(
      map.get(region.id)!.rectFor("front"),
      { x: 4, y: 4, width: 8, height: 8 }
    );
  });

  test("does not move the region for a click without dragging", () => {
    const { map, controller } = makeUvControllerSetup();
    const region = map.create({ width: 8, height: 8 });
    map.showAll = true;
    const moved: EventPayload<"region-moved">[] = [];
    const ended: EventPayload<"region-drag-ended">[] = [];
    map.on("region-moved", (event) => moved.push(event));
    map.on("region-drag-ended", (event) => ended.push(event));

    controller.handleStart({ x: 2, y: 2 });
    controller.handleEnd();

    assert.deepStrictEqual(
      map.get(region.id)!.rectFor("front"),
      region.rectFor("front")
    );
    assert.deepStrictEqual(moved, []);
    assert.deepStrictEqual(ended, [
      { id: region.id, committed: false }
    ]);
  });

  test("clamps the live drag preview to canvas bounds", () => {
    const { map, overlay, controller } = makeUvControllerSetup({
      x: 16,
      y: 16
    });
    map.create({ width: 8, height: 8 });
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleMove({ x: 100, y: 100 });

    assert.deepStrictEqual(
      overlay.previews.at(-1)?.bounds,
      { x: 8, y: 8, width: 8, height: 8 }
    );
  });

  test("clears the live preview on handleEnd", () => {
    const { controller, overlay, map } = makeUvControllerSetup();
    map.create({ width: 8, height: 8 });
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleMove({ x: 6, y: 6 });
    controller.handleEnd();

    assert.strictEqual(overlay.previews.at(-1), null);
  });

  test("cancelDrag discards the in-progress drag without committing", () => {
    const { map, controller, overlay } = makeUvControllerSetup();
    const region = map.create({ width: 8, height: 8 });
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleMove({ x: 6, y: 6 });
    controller.cancelDrag();
    controller.handleEnd();

    assert.deepStrictEqual(
      map.get(region.id)!.rectFor("front"),
      region.rectFor("front")
    );
    assert.strictEqual(overlay.previews.at(-1), null);
  });

  describe("live drag preview (region-dragging)", () => {
    test("toggling aligned edges re-previews only a drag that has moved", () => {
      const { map, controller } = makeUvControllerSetup();
      map.create({ width: 8, height: 8 });
      map.showAll = true;
      const events: EventPayload<"region-dragging">[] = [];
      map.on("region-dragging", (e) => events.push(e));

      controller.handleStart({ x: 2, y: 2 });
      controller.alignEdges(true);
      assert.strictEqual(events.length, 0);

      controller.handleMove({ x: 6, y: 6 });
      controller.alignEdges(false);
      assert.strictEqual(events.length, 2);
    });

    test("handleMove emits a live preview via UVMap on every move, without committing", () => {
      const { map, controller } = makeUvControllerSetup();
      const region = map.create({ width: 8, height: 8 });
      map.showAll = true;
      const events: EventPayload<"region-dragging">[] = [];
      map.on("region-dragging", (e) => events.push(e));

      controller.handleStart({ x: 2, y: 2 });
      controller.handleMove({ x: 6, y: 6 });
      controller.handleMove({ x: 7, y: 7 });

      assert.deepStrictEqual(events.map((e) => e.region.bounds), [
        { x: 4, y: 4, width: 8, height: 8 },
        { x: 5, y: 5, width: 8, height: 8 }
      ]);
      assert.deepStrictEqual(
        map.get(region.id)!.rectFor("front"),
        region.rectFor("front"),
        "not committed yet"
      );
    });

    test("cancelDrag reverts the preview to the region's actual (unchanged) rect", () => {
      const { map, controller } = makeUvControllerSetup();
      const region = map.create({ width: 8, height: 8 });
      map.showAll = true;
      const events: EventPayload<"region-dragging">[] = [];
      map.on("region-dragging", (e) => events.push(e));

      controller.handleStart({ x: 2, y: 2 });
      controller.handleMove({ x: 6, y: 6 });
      controller.cancelDrag();

      assert.deepStrictEqual(
        events.at(-1)!.region.bounds,
        region.rectFor("front")
      );
    });
  });
});
