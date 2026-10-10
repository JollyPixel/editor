// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { LocalHistory } from "./helpers/history/LocalHistory.ts";
import type {
  PixelArtCanvas,
  PixelArtCanvasOptions
} from "#src/PixelArtCanvas.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import { mouseEvent } from "./helpers/events.ts";

function makeManager(
  options: PixelArtCanvasOptions = {}
): PixelArtCanvas {
  const manager = createPixelArtCanvas({
    zoom: { default: 4 },
    history: new LocalHistory(),
    ...options
  }).manager;
  manager.mode = "uv";

  return manager;
}

function drag(
  manager: PixelArtCanvas,
  from: { x: number; y: number; },
  to: { x: number; y: number; }
): void {
  const canvas = manager.canvas();
  canvas.dispatchEvent(mouseEvent("mousemove", from.x, from.y));
  canvas.dispatchEvent(mouseEvent("mousedown", from.x, from.y));
  canvas.dispatchEvent(mouseEvent("mousemove", to.x, to.y));
  canvas.dispatchEvent(mouseEvent("mouseup", to.x, to.y));
}

describe("PixelArtCanvas — uv resize", () => {
  for (const state of ["stacked", "free"] as const) {
    test(`peer drags block ${state} handles and movement until cleared`, () => {
      const { manager, canvas, overlay } = createPixelArtCanvas({
        zoom: { default: 4 },
        uv: { resizable: true }
      });
      manager.mode = "uv";
      const region = manager.uv.create({ width: 4, height: 4 });
      manager.uv.setState(region.id, state);
      manager.uv.select(region.id, "front");
      const before = manager.uv.get(region.id)!;
      const preview = {
        region: before.resized({ ...before.bounds, width: 6 }, "front"),
        face: state === "free" ? "front" : null,
        color: "#ff0000"
      };
      function handles(): NodeListOf<SVGRectElement> {
        return overlay.querySelectorAll("[part='uv-resize-handle']");
      }
      assert.equal(handles().length, 4);

      manager.peerPresence.uv.set("peer-A", preview);
      manager.peerPresence.uv.set("peer-B", preview);
      assert.equal(handles().length, 0);
      canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));
      assert.equal(canvas.style.cursor, "grab");
      drag(manager, { x: 100, y: 100 }, { x: 108, y: 104 });
      drag(manager, { x: 90, y: 90 }, { x: 94, y: 94 });
      assert.deepEqual(manager.uv.get(region.id)!.toJSON(), before.toJSON());

      const other = manager.uv.create({ width: 2, height: 2 });
      manager.uv.select(other.id);
      assert.equal(handles().length, 4);
      manager.uv.select(region.id, "front");
      manager.peerPresence.uv.remove("peer-A");
      assert.equal(handles().length, 0);
      manager.peerPresence.uv.clearAll();
      assert.equal(handles().length, 4);
      drag(manager, { x: 100, y: 100 }, { x: 108, y: 104 });
      assert.equal(manager.uv.get(region.id)!.rectFor("front").width, 6);
      manager.destroy();
    });
  }

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

  test("shows handles only while in uv mode", () => {
    const { manager, overlay } = createPixelArtCanvas({
      uv: { resizable: true }
    });
    const region = manager.uv.create({ width: 4, height: 4 });
    manager.uv.select(region.id);
    function handles(): number {
      return overlay.querySelectorAll("[part='uv-resize-handle']").length;
    }

    assert.equal(handles(), 0);
    manager.mode = "uv";
    assert.equal(handles(), 4);
    manager.mode = "paint";
    assert.equal(handles(), 0);
    manager.tools.uv.resizable = false;
    manager.tools.uv.resizable = true;
    assert.equal(handles(), 0);
    manager.destroy();
  });

  test("shows handles at once when uv is the default mode", () => {
    const { manager, overlay } = createPixelArtCanvas({
      defaultMode: "uv",
      uv: { resizable: true }
    });
    const region = manager.uv.create({ width: 4, height: 4 });
    manager.uv.select(region.id);

    assert.equal(
      overlay.querySelectorAll("[part='uv-resize-handle']").length,
      4
    );
    manager.destroy();
  });
});
