// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { UVSlot } from "#src/uv/region/UVRegion.ts";
import { makeUvControllerSetup } from "../../helpers/uv/controller.ts";

describe("UVController — dragging an unfolded region", () => {
  function makeSetup() {
    const { map, overlay, controller } = makeUvControllerSetup({ x: 64, y: 64 });
    const region = map.create({ width: 4, height: 4 });
    map.applyState(region.id, "unfolded");
    map.select(region.id);

    return { map, overlay, controller, id: region.id };
  }

  test("grabbing any cell drags the whole net", () => {
    const { map, controller, id } = makeSetup();

    controller.handleStart({ x: 6, y: 10 });
    controller.handleMove({ x: 8, y: 13 });
    controller.handleEnd();

    assert.deepStrictEqual(
      map.get(id)!.bounds,
      { x: 2, y: 3, width: 8, height: 12 }
    );
  });

  test("previews the whole region, not the grabbed face", () => {
    const { map, overlay, controller } = makeSetup();
    const faces: (UVSlot | null)[] = [];
    map.on("region-dragging", (event) => faces.push(event.face));

    controller.handleStart({ x: 6, y: 10 });
    controller.handleMove({ x: 8, y: 13 });

    assert.deepStrictEqual(faces, [null, null]);
    assert.strictEqual(overlay.previews.length, 2);
    assert.deepStrictEqual(
      overlay.previews.at(-1)?.regions[0].bounds,
      { x: 2, y: 3, width: 8, height: 12 }
    );
  });
});
