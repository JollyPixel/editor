// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  UVMap,
  type UVMapEvent,
  type UVMapEventType
} from "#src/uv/UVMap.ts";
import { UVController } from "#src/uv/UVController.ts";
import { UV_FACES, type UVFace } from "#src/uv/UVRegion.ts";
import type { UVOverlay } from "#src/rendering/overlays/UVOverlay.ts";
import type { SelectionRect } from "#src/types.ts";

type EventPayload<T extends UVMapEventType> = Parameters<UVMapEvent[T]>[0];

// UVController only calls overlay.setLiveOverride; FakeOverlay implements that
// structural subset and is cast to UVOverlay at the single injection site.
class FakeOverlay {
  overrides: { id: string; face: UVFace | null; rect: SelectionRect | null; }[] = [];

  setLiveOverride(
    id: string,
    face: UVFace | null,
    rect: SelectionRect | null
  ): void {
    this.overrides.push({ id, face, rect });
  }
}

function makeSetup(
  size = { x: 32, y: 32 }
): { map: UVMap; overlay: FakeOverlay; controller: UVController; } {
  const map = new UVMap({ getCanvasSize: () => size });
  const overlay = new FakeOverlay();
  const controller = new UVController({
    uvMap: map,
    overlay: overlay as unknown as UVOverlay
  });

  return { map, overlay, controller };
}

describe("UVController — hit-test / select on miss", () => {
  test("does not select the empty half of a triangular face", () => {
    const { map, controller } = makeSetup();
    map.restore({
      id: "ramp",
      color: "#f00",
      state: "uncollapsed",
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

  test("does not select outside a triangle's bounding rect", () => {
    const { map, controller } = makeSetup();
    map.restore({
      id: "triangle",
      color: "#f00",
      state: "uncollapsed",
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

    controller.handleStart({ x: 100, y: -100 });

    assert.strictEqual(map.selectedRegionId, null);
  });

  test("selects a visible region hit by handleStart", () => {
    const { map, controller } = makeSetup();
    const region = map.create({ width: 8, height: 8 });
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });

    assert.strictEqual(map.selectedRegionId, region.id);
  });

  test("cannot hit an invisible region", () => {
    const { map, controller } = makeSetup();
    map.create({ width: 8, height: 8 });

    controller.handleStart({ x: 2, y: 2 });

    assert.strictEqual(map.selectedRegionId, null);
  });

  test("deselects on a miss", () => {
    const { map, controller } = makeSetup();
    const region = map.create({ width: 8, height: 8 });
    map.showAll = true;
    controller.handleStart({ x: 2, y: 2 });
    assert.strictEqual(map.selectedRegionId, region.id);

    controller.handleStart({ x: 20, y: 20 });

    assert.strictEqual(map.selectedRegionId, null);
  });
});

describe("UVController — drag to move", () => {
  test("does not commit the move until handleEnd", () => {
    const { map, controller } = makeSetup();
    const region = map.create({ width: 8, height: 8 });
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleMove({ x: 6, y: 6 });

    assert.deepStrictEqual(
      map.get(region.id)!.rectFor("front"),
      region.rectFor("front")
    );
  });

  test("commits the accumulated delta on handleEnd", () => {
    const { map, controller } = makeSetup();
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
    const { map, controller } = makeSetup();
    const region = map.create({ width: 8, height: 8 });
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleEnd();

    assert.deepStrictEqual(
      map.get(region.id)!.rectFor("front"),
      region.rectFor("front")
    );
  });

  test("clamps the live drag preview to canvas bounds", () => {
    const { map, overlay, controller } = makeSetup({
      x: 16,
      y: 16
    });
    map.create({ width: 8, height: 8 });
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleMove({ x: 100, y: 100 });

    const last = overlay.overrides.at(-1)!;
    assert.deepStrictEqual(
      last.rect,
      { x: 8, y: 8, width: 8, height: 8 }
    );
  });

  test("clears the live override on handleEnd", () => {
    const { controller, overlay, map } = makeSetup();
    map.create({ width: 8, height: 8 });
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleMove({ x: 6, y: 6 });
    controller.handleEnd();

    assert.strictEqual(
      overlay.overrides.at(-1)!.rect,
      null
    );
  });

  test("cancelDrag discards the in-progress drag without committing", () => {
    const { map, controller, overlay } = makeSetup();
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
    assert.strictEqual(
      overlay.overrides.at(-1)!.rect,
      null
    );
  });

  test("handleMove/handleEnd are no-ops without an active drag", () => {
    const { controller } = makeSetup();

    assert.doesNotThrow(() => {
      controller.handleMove({ x: 1, y: 1 });
      controller.handleEnd();
    });
  });

  describe("live drag preview (region-dragging)", () => {
    test("handleMove emits a live preview via UVMap on every move, without committing", () => {
      const { map, controller } = makeSetup();
      const region = map.create({ width: 8, height: 8 });
      map.showAll = true;
      const events: EventPayload<"region-dragging">[] = [];
      map.on("region-dragging", (e) => events.push(e));

      controller.handleStart({ x: 2, y: 2 });
      controller.handleMove({ x: 6, y: 6 });
      controller.handleMove({ x: 7, y: 7 });

      assert.deepStrictEqual(events.map((e) => e.rect), [
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
      const { map, controller } = makeSetup();
      const region = map.create({ width: 8, height: 8 });
      map.showAll = true;
      const events: EventPayload<"region-dragging">[] = [];
      map.on("region-dragging", (e) => events.push(e));

      controller.handleStart({ x: 2, y: 2 });
      controller.handleMove({ x: 6, y: 6 });
      controller.cancelDrag();

      assert.deepStrictEqual(
        events.at(-1)!.rect,
        region.rectFor("front")
      );
    });
  });
});

describe("UVController — cycling through an overlapping stack", () => {
  test("a repeat click advances to the next face of the stack", () => {
    const { map, controller } = makeSetup();
    const region = map.create({ width: 8, height: 8 });
    map.uncollapse(region.id);
    map.showAll = true;

    const picked: (string | null)[] = [];
    for (let index = 0; index < UV_FACES.length; index++) {
      controller.handleStart({ x: 2, y: 2 });
      controller.handleEnd();
      picked.push(map.selectedFace);
    }

    assert.deepStrictEqual(
      picked,
      [...UV_FACES],
      "six stacked faces must each be reachable by clicking again"
    );
  });

  test("wraps back to the first face after the last one", () => {
    const { map, controller } = makeSetup();
    const region = map.create({ width: 8, height: 8 });
    map.uncollapse(region.id);
    map.showAll = true;

    for (let index = 0; index < UV_FACES.length; index++) {
      controller.handleStart({ x: 2, y: 2 });
      controller.handleEnd();
    }
    controller.handleStart({ x: 2, y: 2 });

    assert.strictEqual(map.selectedFace, UV_FACES[0]);
  });

  test("dragging a face out of the stack changes the stack, resetting the cycle", () => {
    const { map, controller } = makeSetup();
    const region = map.create({ width: 8, height: 8 });
    map.uncollapse(region.id);
    map.showAll = true;

    // Pick "front", then drag it away from the shared position.
    controller.handleStart({ x: 2, y: 2 });
    controller.handleMove({ x: 22, y: 22 });
    controller.handleEnd();

    // The remaining five still coincide, so this is a different stack.
    controller.handleStart({ x: 2, y: 2 });

    assert.strictEqual(map.selectedFace, "back");
  });

  test("an external selection change resets the cycle", () => {
    const { map, controller } = makeSetup();
    const region = map.create({ width: 8, height: 8 });
    map.uncollapse(region.id);
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleEnd();
    assert.strictEqual(map.selectedFace, "front");

    // e.g. a 3D picker, undo, or a peer selecting for us.
    map.select(region.id, "top");
    controller.handleStart({ x: 2, y: 2 });

    assert.strictEqual(
      map.selectedFace,
      "front",
      "the cycle restarts at the top of the stack, not where it left off"
    );
  });

  test("a miss resets the cycle", () => {
    const { map, controller } = makeSetup();
    const region = map.create({ width: 8, height: 8 });
    map.uncollapse(region.id);
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleEnd();
    controller.handleStart({ x: 30, y: 30 });
    controller.handleEnd();
    map.showAll = true;
    controller.handleStart({ x: 2, y: 2 });

    assert.strictEqual(map.selectedFace, "front");
  });

  test("dragging moves the face the cycle landed on", () => {
    const { map, controller } = makeSetup();
    const region = map.create({ width: 8, height: 8 });
    map.uncollapse(region.id);
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

  test("a collapsed region is a single-entry stack, so repeat clicks keep it selected", () => {
    const { map, controller } = makeSetup();
    const region = map.create({ width: 8, height: 8 });
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleEnd();
    controller.handleStart({ x: 2, y: 2 });

    assert.strictEqual(map.selectedRegionId, region.id);
    assert.strictEqual(map.selectedFace, null);
  });
});

describe("UVController — isDragging", () => {
  test("is false until a drag starts, true while dragging, false again after handleEnd", () => {
    const { map, controller } = makeSetup();
    map.create({ width: 8, height: 8 });
    map.showAll = true;

    assert.ok(!controller.isDragging);

    controller.handleStart({ x: 2, y: 2 });
    assert.ok(controller.isDragging);

    controller.handleEnd();
    assert.ok(!controller.isDragging);
  });

  test("stays false when handleStart misses (no drag to track)", () => {
    const { controller } = makeSetup();

    controller.handleStart({ x: 2, y: 2 });

    assert.ok(!controller.isDragging);
  });

  test("is false again after cancelDrag", () => {
    const { map, controller } = makeSetup();
    map.create({ width: 8, height: 8 });
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.cancelDrag();

    assert.ok(!controller.isDragging);
  });
});

describe("UVController — handleDelete", () => {
  test("deletes the selected region and returns true", () => {
    const { map, controller } = makeSetup();
    const region = map.create({ width: 8, height: 8 });
    map.select(region.id);

    const result = controller.handleDelete();

    assert.ok(result);
    assert.strictEqual(map.get(region.id), undefined);
  });

  test("returns false when nothing is selected", () => {
    const { controller } = makeSetup();

    assert.ok(!controller.handleDelete());
  });
});
