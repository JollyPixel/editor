// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { makeUvControllerSetup } from "../../helpers/uv/controller.ts";

function makeSnappingSetup() {
  const setup = makeUvControllerSetup({ x: 64, y: 64 });
  setup.grid.size = 16;
  setup.grid.snap = true;
  setup.map.showAll = true;

  return setup;
}

describe("UVController — snapping to the texture grid", () => {
  test("a drag moves the region top-left to the nearest cell line", () => {
    const { map, controller } = makeSnappingSetup();
    const region = map.create({ width: 8, height: 8 });

    controller.handleStart({ x: 2, y: 2 });
    controller.handleMove({ x: 9, y: 13 });
    controller.handleEnd();

    assert.deepEqual(
      map.get(region.id)!.bounds,
      { x: 0, y: 16, width: 8, height: 8 }
    );
  });

  test("an unaligned region lands on a cell line on its first move", () => {
    const { map, controller } = makeSnappingSetup();
    const region = map.create({ width: 8, height: 8 });
    map.move(region.id, { x: 3, y: 0, width: 8, height: 8 });

    controller.handleStart({ x: 4, y: 2 });
    controller.handleMove({ x: 5, y: 2 });
    controller.handleEnd();

    assert.deepEqual(
      map.get(region.id)!.bounds,
      { x: 0, y: 0, width: 8, height: 8 }
    );
  });

  test("a resize moves the grabbed edge to the nearest cell line", () => {
    const { map, controller } = makeSnappingSetup();
    controller.resizable = true;
    const region = map.create({ width: 8, height: 8 });
    map.select(region.id);

    controller.handleStart({ x: 8, y: 8 });
    controller.handleMove({ x: 19, y: 30 });
    controller.handleEnd();

    assert.deepEqual(
      map.get(region.id)!.bounds,
      { x: 0, y: 0, width: 16, height: 32 }
    );
  });

  test("bypassing the snap mid-drag follows the pointer, releasing it snaps again", () => {
    const { map, controller, overlay } = makeSnappingSetup();
    const region = map.create({ width: 8, height: 8 });

    controller.handleStart({ x: 2, y: 2 });
    controller.handleMove({ x: 7, y: 2 });
    controller.snapBypassed = true;
    assert.deepEqual(
      overlay.previews.at(-1)?.regions[0].bounds,
      { x: 5, y: 0, width: 8, height: 8 }
    );

    controller.snapBypassed = false;
    controller.handleEnd();

    assert.deepEqual(map.get(region.id)!.bounds, region.bounds);
  });
});
