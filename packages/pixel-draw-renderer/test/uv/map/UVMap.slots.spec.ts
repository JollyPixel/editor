// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVRegion } from "#src/uv/region/UVRegion.ts";
import type { UVMap } from "#src/uv/map/UVMap.ts";
import {
  makeUvMap,
  type EventPayload
} from "../../helpers/uv/map.ts";

function makeFreeWithInactiveSlot(): UVMap {
  const map = makeUvMap({ x: 64, y: 64 });
  map.restore(new UVRegion({
    id: "r1",
    color: "#f00",
    state: "free",
    faces: {
      front: { x: 0, y: 0, width: 4, height: 4 },
      back: { x: 8, y: 0, width: 4, height: 4 }
    },
    activeFaces: ["front"]
  }));

  return map;
}

describe("UVMap — inactive slots", () => {
  test("refuses to move an inactive slot", () => {
    const map = makeFreeWithInactiveSlot();

    assert.strictEqual(map.move("r1", { x: 20, y: 20, width: 4, height: 4 }, "back"), false);
    assert.deepStrictEqual(map.get("r1")?.rectFor("back"), { x: 8, y: 0, width: 4, height: 4 });
  });

  test("refuses to rotate an inactive slot", () => {
    assert.strictEqual(makeFreeWithInactiveSlot().rotate("r1", "cw", "back"), false);
  });

  test("never selects an inactive slot", () => {
    const map = makeFreeWithInactiveSlot();

    map.select("r1", "back");

    assert.strictEqual(map.selectedSlot, "front");
  });
});

describe("UVMap — endPreview", () => {
  test("emits region-drag-ended with the commit outcome", () => {
    const map = makeUvMap();
    const events: EventPayload<"region-drag-ended">[] = [];
    map.on("region-drag-ended", (event) => events.push(event));

    map.endPreview("r1", true);

    assert.deepStrictEqual(events, [{ id: "r1", committed: true }]);
  });
});
