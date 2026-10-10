// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import {
  createPixelArtCanvas,
  type TestCanvasOptions
} from "./helpers/canvas.ts";
import { mouseEvent } from "./helpers/events.ts";
import {
  createUvCanvas,
  drag
} from "./helpers/uv/canvas.ts";

function makeManager(
  options: TestCanvasOptions = {}
): PixelArtCanvas {
  const manager = createUvCanvas(options);
  manager.mode = "uv";

  return manager;
}

describe("PixelArtCanvas — uv resize", () => {
  test("announces a resize on pointer-down and clears a no-op drag", () => {
    const manager = makeManager({ uv: { resizable: true } });
    const region = manager.uv.create({ width: 4, height: 4 });
    manager.uv.select(region.id);
    const widths: number[] = [];
    const ended: boolean[] = [];
    manager.uv.on("region-dragging", ({ region }) => {
      widths.push(region.bounds.width);
    });
    manager.uv.on("region-drag-ended", ({ committed }) => {
      ended.push(committed);
    });

    manager.canvas().dispatchEvent(mouseEvent("mousedown", 100, 100));
    assert.deepEqual(widths, [4]);
    assert.deepEqual(manager.uv.get(region.id)!.toJSON(), region.toJSON());
    manager.canvas().dispatchEvent(mouseEvent("mouseup", 100, 100));
    assert.deepEqual(ended, [false]);
    manager.destroy();
  });

  test("a hovered corner shows its cursor and resizes in one undo step", () => {
    const manager = makeManager({ uv: { resizable: true } });
    const region = manager.uv.create({ width: 4, height: 4 });
    manager.uv.select(region.id);

    manager.canvas().dispatchEvent(mouseEvent("mousemove", 100, 100));
    assert.equal(manager.canvas().style.cursor, "nwse-resize");

    drag(manager, { x: 100, y: 100 }, { x: 108, y: 104 });

    assert.deepEqual(
      manager.uv.get(region.id)!.bounds,
      { x: 0, y: 0, width: 6, height: 5 }
    );
    manager.undo();
    assert.deepEqual(manager.uv.get(region.id)!.toJSON(), region.toJSON());
    manager.destroy();
  });

  test("moves an edge only once the pointer passes half a pixel from the grab", () => {
    const manager = makeManager({ uv: { resizable: true } });
    const region = manager.uv.create({ width: 4, height: 4 });
    manager.uv.select(region.id);
    const canvas = manager.canvas();
    const widths: number[] = [];
    manager.uv.on("region-dragging", (event) => widths.push(event.region.bounds.width));

    canvas.dispatchEvent(mouseEvent("mousemove", 99, 90));
    canvas.dispatchEvent(mouseEvent("mousedown", 99, 90));
    canvas.dispatchEvent(mouseEvent("mousemove", 100, 90));
    assert.deepEqual(widths, [4]);

    canvas.dispatchEvent(mouseEvent("mousemove", 106, 90));
    canvas.dispatchEvent(mouseEvent("mouseup", 106, 90));
    assert.equal(manager.uv.get(region.id)!.bounds.width, 6);
    manager.destroy();
  });

  test("leaves handles off by default", () => {
    const manager = makeManager();
    const region = manager.uv.create({ width: 4, height: 4 });
    manager.uv.select(region.id);

    manager.canvas().dispatchEvent(mouseEvent("mousemove", 99, 99));
    assert.equal(manager.canvas().style.cursor, "grab");

    drag(manager, { x: 99, y: 99 }, { x: 107, y: 103 });

    assert.deepEqual(
      manager.uv.get(region.id)!.bounds,
      { x: 2, y: 1, width: 4, height: 4 }
    );
    manager.destroy();
  });

  test("resizes the grabbed face of an unfolded net", () => {
    const manager = makeManager({ uv: { resizable: true } });
    const region = manager.uv.create({ width: 2, height: 2 });
    manager.uv.setState(region.id, "unfolded");
    manager.uv.select(region.id);
    const before = manager.uv.get(region.id)!;
    const front = before.geometryFor("front");
    assert.ok(!("shape" in front));
    const edge = 84 + (front.x + front.width) * 4;
    const middle = 84 + (front.y + 1) * 4;

    drag(manager, { x: edge - 1, y: middle }, { x: edge + 3, y: middle });

    const after = manager.uv.get(region.id)!;
    assert.deepEqual(after.geometryFor("front"), { ...front, width: 3 });
    assert.equal(after.bounds.width, before.bounds.width + 1);
    manager.destroy();
  });

  test("shows the size of a net face too small to label while it is resized", () => {
    const { manager, overlay } = createPixelArtCanvas({
      zoom: { default: 4 },
      uv: { resizable: true }
    });
    manager.mode = "uv";
    const region = manager.uv.create({ width: 2, height: 2 });
    manager.uv.setState(region.id, "unfolded");
    manager.uv.select(region.id);
    manager.uv.showSizeLabels = true;
    const front = manager.uv.get(region.id)!.geometryFor("front");
    assert.ok(!("shape" in front));
    const edge = 84 + (front.x + front.width) * 4;
    const middle = 84 + (front.y + 1) * 4;
    const canvas = manager.canvas();
    function visibleSizes(): (string | null)[] {
      return [...overlay.querySelectorAll("[data-overlay='uv-size']")]
        .filter((label) => label.getAttribute("visibility") === "visible")
        .map((label) => label.textContent);
    }
    assert.deepEqual(visibleSizes(), []);

    canvas.dispatchEvent(mouseEvent("mousemove", edge - 1, middle));
    canvas.dispatchEvent(mouseEvent("mousedown", edge - 1, middle));
    canvas.dispatchEvent(mouseEvent("mousemove", edge + 3, middle));
    assert.deepEqual(visibleSizes(), ["3×2"]);

    canvas.dispatchEvent(mouseEvent("mouseup", edge + 3, middle));
    assert.deepEqual(visibleSizes(), []);
    manager.destroy();
  });

  test("holding the line modifier mid-drag resizes the aligned row of a net", () => {
    const manager = makeManager({ uv: { resizable: true } });
    const region = manager.uv.create({ width: 2, height: 2 });
    manager.uv.setState(region.id, "unfolded");
    manager.uv.select(region.id);
    const before = manager.uv.get(region.id)!;
    const front = before.geometryFor("front");
    assert.ok(!("shape" in front));
    const bottom = 84 + (front.y + front.height) * 4;
    const middle = 84 + (front.x + 1) * 4;
    const row = before.activeSlots.filter((slot) => {
      const geometry = before.geometryFor(slot);

      return !("shape" in geometry) && geometry.y === front.y;
    });
    const canvas = manager.canvas();

    canvas.dispatchEvent(mouseEvent("mousemove", middle, bottom - 1));
    canvas.dispatchEvent(mouseEvent("mousedown", middle, bottom - 1));
    canvas.dispatchEvent(mouseEvent("mousemove", middle, bottom + 3));
    manager.shortcuts.lineHeld = true;
    canvas.dispatchEvent(mouseEvent("mouseup", middle, bottom + 3));
    manager.shortcuts.lineHeld = false;

    const after = manager.uv.get(region.id)!;
    assert.ok(row.length > 1);
    for (const slot of row) {
      const geometry = after.geometryFor(slot);
      assert.ok(!("shape" in geometry));
      assert.equal(geometry.height, 3, slot);
    }
    manager.destroy();
  });

  test("leaving uv mode mid-drag cancels the resize", () => {
    const manager = makeManager({ uv: { resizable: true } });
    const region = manager.uv.create({ width: 4, height: 4 });
    manager.uv.select(region.id);
    const ended: boolean[] = [];
    manager.uv.on("region-drag-ended", ({ committed }) => ended.push(committed));
    const canvas = manager.canvas();

    canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));
    canvas.dispatchEvent(mouseEvent("mousedown", 100, 100));
    canvas.dispatchEvent(mouseEvent("mousemove", 108, 108));
    manager.mode = "paint";

    assert.equal(manager.uv.get(region.id), region);
    assert.deepEqual(ended, [false]);
    manager.destroy();
  });
});
