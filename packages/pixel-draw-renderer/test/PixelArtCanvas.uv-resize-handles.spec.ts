// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import { mouseEvent } from "./helpers/events.ts";
import { drag } from "./helpers/uv/canvas.ts";

describe("PixelArtCanvas — uv resize handles", () => {
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
