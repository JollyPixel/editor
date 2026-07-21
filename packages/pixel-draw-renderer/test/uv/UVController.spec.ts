// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  UVMap,
  type UVMapEvent
} from "#src/uv/UVMap.ts";
import { UVController } from "#src/uv/UVController.ts";
import type { UVOverlay } from "#src/rendering/overlays/UVOverlay.ts";
import type { SelectionRect } from "#src/types.ts";

// UVController only calls overlay.setLiveOverride; FakeOverlay implements that
// structural subset and is cast to UVOverlay at the single injection site.
class FakeOverlay {
  overrides: { id: string; rect: SelectionRect | null; }[] = [];

  setLiveOverride(
    id: string,
    rect: SelectionRect | null
  ): void {
    this.overrides.push({ id, rect });
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
      map.get(region.id)!.rect,
      region.rect
    );
  });

  test("commits the accumulated delta on handleEnd", () => {
    const { map, controller } = makeSetup();
    const region = map.create({ width: 8, height: 8 });
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleMove({ x: 6, y: 6 });
    controller.handleEnd();

    assert.deepStrictEqual(map.get(region.id)!.rect, { x: 4, y: 4, width: 8, height: 8 });
  });

  test("does not move the region for a click without dragging", () => {
    const { map, controller } = makeSetup();
    const region = map.create({ width: 8, height: 8 });
    map.showAll = true;

    controller.handleStart({ x: 2, y: 2 });
    controller.handleEnd();

    assert.deepStrictEqual(
      map.get(region.id)!.rect,
      region.rect
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
      map.get(region.id)!.rect,
      region.rect
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
      const events: Extract<UVMapEvent, { type: "region-dragging"; }>[] = [];
      map.on("region-dragging", (e) => events.push(e));

      controller.handleStart({ x: 2, y: 2 });
      controller.handleMove({ x: 6, y: 6 });
      controller.handleMove({ x: 7, y: 7 });

      assert.deepStrictEqual(events.map((e) => e.rect), [
        { x: 4, y: 4, width: 8, height: 8 },
        { x: 5, y: 5, width: 8, height: 8 }
      ]);
      assert.deepStrictEqual(
        map.get(region.id)!.rect,
        region.rect,
        "not committed yet"
      );
    });

    test("cancelDrag reverts the preview to the region's actual (unchanged) rect", () => {
      const { map, controller } = makeSetup();
      const region = map.create({ width: 8, height: 8 });
      map.showAll = true;
      const events: Extract<UVMapEvent, { type: "region-dragging"; }>[] = [];
      map.on("region-dragging", (e) => events.push(e));

      controller.handleStart({ x: 2, y: 2 });
      controller.handleMove({ x: 6, y: 6 });
      controller.cancelDrag();

      assert.deepStrictEqual(
        events.at(-1)!.rect,
        region.rect
      );
    });
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
