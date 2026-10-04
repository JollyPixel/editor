// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { EventPayload } from "../../helpers/uv/map.ts";
import { makeUvControllerSetup } from "../../helpers/uv/controller.ts";

describe("UVController — hit-test / select on miss", () => {
  test("does not select the empty half of a triangular face", () => {
    const { map, controller } = makeUvControllerSetup();
    map.restore({
      id: "ramp",
      color: "#f00",
      state: "free",
      activeFaces: ["left"],
      faces: {
        front: { x: 0, y: 0, width: 8, height: 8 },
        back: { x: 0, y: 0, width: 8, height: 8 },
        left: {
          shape: "triangle",
          corner: "top-right",
          rect: { x: 0, y: 0, width: 8, height: 8 }
        },
        right: { x: 0, y: 0, width: 8, height: 8 },
        top: { x: 0, y: 0, width: 8, height: 8 },
        bottom: { x: 0, y: 0, width: 8, height: 8 }
      }
    });
    map.showAll = true;

    controller.handleStart({ x: 1, y: 6 });

    assert.strictEqual(map.selectedRegionId, null);
  });

  test("selects a visible region hit by handleStart", () => {
    const { map, controller } = makeUvControllerSetup();
    const region = map.create({ width: 8, height: 8 });
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });

    assert.strictEqual(map.selectedRegionId, region.id);
  });

  test("cannot hit an invisible region", () => {
    const { map, controller } = makeUvControllerSetup();
    map.create({ width: 8, height: 8 });

    controller.handleStart({ x: 2, y: 2 });

    assert.strictEqual(map.selectedRegionId, null);
  });

  test("deselects on a miss", () => {
    const { map, controller } = makeUvControllerSetup();
    const region = map.create({ width: 8, height: 8 });
    map.showAll = true;
    controller.handleStart({ x: 2, y: 2 });
    assert.strictEqual(map.selectedRegionId, region.id);

    controller.handleStart({ x: 20, y: 20 });

    assert.strictEqual(map.selectedRegionId, null);
  });
});

describe("UVController — deselectOnEmptyClick: false", () => {
  test("keeps the selection on a miss and emits no selection-changed", () => {
    const { map, controller } = makeUvControllerSetup({ x: 32, y: 32 }, false);
    const region = map.create({ width: 8, height: 8 });
    map.showAll = true;
    controller.handleStart({ x: 2, y: 2 });
    const events: EventPayload<"selection-changed">[] = [];
    map.on("selection-changed", (event) => events.push(event));

    controller.handleStart({ x: 20, y: 20 });

    assert.strictEqual(map.selectedRegionId, region.id);
    assert.strictEqual(events.length, 0);
  });

  test("a miss starts no drag, so the selected region cannot move", () => {
    const { map, overlay, controller } = makeUvControllerSetup({ x: 32, y: 32 }, false);
    const region = map.create({ width: 8, height: 8 });
    map.showAll = true;
    controller.handleStart({ x: 2, y: 2 });
    controller.handleEnd();
    overlay.previews.length = 0;

    controller.handleStart({ x: 20, y: 20 });
    controller.handleMove({ x: 24, y: 24 });
    controller.handleEnd();

    assert.strictEqual(overlay.previews.length, 0);
    assert.deepStrictEqual(
      map.get(region.id)!.rectFor("front"),
      { x: 0, y: 0, width: 8, height: 8 }
    );
  });

  test("a miss still restarts the click cycle over coincident regions", () => {
    const { map, controller } = makeUvControllerSetup({ x: 32, y: 32 }, false);
    const first = map.restore({
      id: "first",
      color: "#f00",
      state: "stacked",
      rect: { x: 0, y: 0, width: 8, height: 8 }
    });
    const second = map.restore({
      id: "second",
      color: "#0f0",
      state: "stacked",
      rect: { x: 0, y: 0, width: 8, height: 8 }
    });
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    assert.strictEqual(map.selectedRegionId, first.id);
    controller.handleStart({ x: 2, y: 2 });
    assert.strictEqual(map.selectedRegionId, second.id);

    controller.handleStart({ x: 20, y: 20 });
    assert.strictEqual(map.selectedRegionId, second.id);
    controller.handleStart({ x: 2, y: 2 });

    assert.strictEqual(
      map.selectedRegionId,
      second.id,
      "the miss kept the selection, so the cycle restarts on the painted region"
    );

    controller.handleStart({ x: 2, y: 2 });

    assert.strictEqual(map.selectedRegionId, first.id);
  });
});

describe("UVController — rotate", () => {
  test("refuses to rotate while a drag is in progress and rotates once it ends", () => {
    const { map, controller } = makeUvControllerSetup();
    map.create({ width: 8, height: 8 });
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    assert.strictEqual(controller.rotate("cw"), false);

    controller.handleEnd();
    assert.strictEqual(controller.rotate("cw"), true);
  });
});

describe("UVController — handleDelete", () => {
  test("deletes the selected region and returns true", () => {
    const { map, controller } = makeUvControllerSetup();
    const region = map.create({ width: 8, height: 8 });
    map.select(region.id);

    const result = controller.handleDelete();

    assert.ok(result);
    assert.strictEqual(map.get(region.id), undefined);
  });

  test("returns false when nothing is selected", () => {
    const { controller } = makeUvControllerSetup();

    assert.ok(!controller.handleDelete());
  });
});
