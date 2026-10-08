// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { LocalHistory } from "./helpers/history/LocalHistory.ts";
import {
  createPixelArtCanvas,
  type CreatedPixelArtCanvas
} from "./helpers/canvas.ts";
import {
  mouseEvent,
  stroke,
  wheel
} from "./helpers/events.ts";
import { readPixel } from "./fixtures/canvas.ts";
import { stubRect } from "./helpers/dom.ts";
import type { SelectionRect } from "#src/types.ts";
import type { SelectionProgressEvent } from "#src/tools/SelectEngine.events.ts";

function selectedCanvas(): CreatedPixelArtCanvas {
  const result = createPixelArtCanvas({
    zoom: { default: 4, smoothing: 0 },
    history: new LocalHistory(),
    clipboard: null,
    select: { eraseColor: "#FF00FF" }
  });
  result.manager.mode = "select";
  stroke(result.canvas, [[92, 92], [100, 100]]);

  return result;
}

function assertOutline(
  overlay: SVGSVGElement,
  rect: SelectionRect
): void {
  const left = 84 + rect.x * 4;
  const top = 84 + rect.y * 4;
  const right = left + rect.width * 4;
  const bottom = top + rect.height * 4;
  assert.equal(
    overlay.querySelector("[data-overlay=selection]")?.getAttribute("d"),
    `M ${left} ${top} L ${right} ${top} L ${right} ${bottom} ` +
    `L ${left} ${bottom} Z`
  );
}

function visibleHandles(
  overlay: SVGSVGElement
): Element[] {
  return [...overlay.querySelectorAll(
    "[data-overlay=selection-resize-handle][visibility=visible]"
  )];
}

describe("PixelArtCanvas selection resize", () => {
  const corners = [
    { from: [92, 92], to: [88, 88], x: 1, y: 1, cursor: "nwse-resize" },
    { from: [104, 92], to: [108, 88], x: 2, y: 1, cursor: "nesw-resize" },
    { from: [92, 104], to: [88, 108], x: 1, y: 2, cursor: "nesw-resize" },
    { from: [104, 104], to: [108, 108], x: 2, y: 2, cursor: "nwse-resize" }
  ] satisfies Array<{
    from: [number, number];
    to: [number, number];
    x: number;
    y: number;
    cursor: string;
  }>;

  for (const { from, to, x, y, cursor } of corners) {
    test(`resizes from ${from} with its opposite corner anchored`, () => {
      const { manager, canvas, overlay } = selectedCanvas();
      const before = manager.texture;
      const progress: SelectionProgressEvent[] = [];
      let idle = 0;
      let committed = 0;
      let commands = 0;
      let stateChanges = 0;
      manager.selectionEvents.on("selection-progress", (event) => {
        progress.push(event);
      });
      manager.selectionEvents.on("selection-idle", () => idle++);
      manager.selectionEvents.on("selection-committed", () => committed++);
      manager.selectionEvents.on("selection-state-changed", () => stateChanges++);
      manager.document.on("command", () => commands++);
      canvas.dispatchEvent(mouseEvent("mousemove", ...from));
      assert.equal(canvas.style.cursor, cursor);
      canvas.dispatchEvent(mouseEvent("mousedown", ...from));
      canvas.dispatchEvent(mouseEvent("mousemove", ...to));
      assert.equal(canvas.style.cursor, cursor);
      assert.equal(manager.tools.select.hasSelection, true);
      assert.equal(manager.tools.select.rotate(), false);
      assert.equal(manager.tools.select.delete(), false);
      assert.equal(manager.tools.select.flipHorizontal(), false);
      assert.equal(manager.tools.select.flipVertical(), false);
      const rect = { x, y, width: 4, height: 4 };
      assertOutline(overlay, rect);
      assert.equal(overlay.querySelector(
        "[data-overlay=selection-size]"
      )?.textContent, "4×4");
      assert.deepEqual(progress, [{ phase: "creating", rect }]);
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      assertOutline(overlay, rect);
      assert.deepEqual(manager.texture, before);
      assert.equal(manager.canUndo(), false);
      assert.equal(commands, 0);
      assert.equal(stateChanges, 0);
      assert.equal(idle, 1);
      assert.equal(committed, 0);
      assert.equal(visibleHandles(overlay).length, 4);
      manager.destroy();
    });
  }

  test("snaps from the grab offset, clips on release and retains 1×1", () => {
    const { manager, canvas, overlay } = selectedCanvas();
    stroke(canvas, [[106, 106], [107, 107]]);
    assertOutline(overlay, { x: 2, y: 2, width: 3, height: 3 });
    canvas.dispatchEvent(mouseEvent("mousedown", 106, 106));
    canvas.dispatchEvent(mouseEvent("mousemove", 150, 150));
    assertOutline(overlay, { x: 2, y: 2, width: 14, height: 14 });
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    assertOutline(overlay, { x: 2, y: 2, width: 6, height: 6 });
    stroke(canvas, [[116, 116], [80, 80]]);
    assertOutline(overlay, { x: 2, y: 2, width: 1, height: 1 });
    assert.equal(manager.tools.select.hasSelection, true);
    stroke(canvas, [[94, 94], [98, 98]]);
    assertOutline(overlay, { x: 3, y: 3, width: 1, height: 1 });
    manager.destroy();
  });

  test("captures newly included pixels for copy and later deletion", async() => {
    const { manager, canvas, overlay } = selectedCanvas();
    manager.brush.primary.set("#00FF00");
    manager.commitPixels([{ x: 5, y: 5 }]);
    const before = manager.texture;
    const depth = manager.undoDepth();
    stroke(canvas, [[104, 104], [108, 108]]);
    assert.deepEqual(manager.texture, before);
    assert.equal(manager.undoDepth(), depth);
    await manager.copySelection();
    manager.tools.select.delete();
    assert.deepEqual(readPixel(manager.texture, { x: 5, y: 5 }, 8),
      [255, 0, 255, 255]);
    assert.deepEqual(readPixel(manager.texture, { x: 6, y: 5 }, 8),
      [255, 255, 255, 255]);
    manager.mode = "paint";
    canvas.dispatchEvent(mouseEvent("mousemove", 100, 100));
    await manager.pasteClipboard();
    assert.equal(manager.tools.select.isFloating, true);
    assert.equal(visibleHandles(overlay).length, 0);
    manager.mode = "paint";
    assert.deepEqual(readPixel(manager.texture, { x: 5, y: 5 }, 8),
      [0, 255, 0, 255]);
    manager.destroy();
  });

  test("the interior of a 1×1 selection can move at minimum zoom", () => {
    const { manager, canvas } = createPixelArtCanvas({
      zoom: { default: 1, smoothing: 0 }
    });
    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.mode = "select";
    stroke(canvas, [[98, 98], [100, 100]]);
    stroke(canvas, [[101, 101], [99, 99]]);
    canvas.dispatchEvent(mouseEvent("mousedown", 98.5, 98.5));
    assert.equal(canvas.style.cursor, "grabbing");
    canvas.dispatchEvent(mouseEvent("mousemove", 99.5, 99.5));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    assert.deepEqual(readPixel(manager.texture, { x: 3, y: 3 }, 8),
      [0, 0, 0, 255]);
    assert.deepEqual(readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [255, 255, 255, 255]);
    manager.destroy();
  });

  test("shrinking excludes pixels from a subsequent move and its undo", () => {
    const { manager, canvas, overlay } = selectedCanvas();
    manager.commitPixels([{ x: 2, y: 2 }, { x: 4, y: 4 }]);
    stroke(canvas, [[104, 104], [100, 100]]);
    assertOutline(overlay, { x: 2, y: 2, width: 2, height: 2 });
    stroke(canvas, [[96, 96], [108, 96]]);
    assert.deepEqual(readPixel(manager.texture, { x: 4, y: 4 }, 8),
      [0, 0, 0, 255]);
    assert.deepEqual(readPixel(manager.texture, { x: 5, y: 2 }, 8),
      [0, 0, 0, 255]);
    manager.shortcuts.undo();
    assertOutline(overlay, { x: 2, y: 2, width: 2, height: 2 });
    assert.equal(visibleHandles(overlay).length, 4);
    assert.deepEqual(readPixel(manager.texture, { x: 2, y: 2 }, 8),
      [0, 0, 0, 255]);
    manager.destroy();
  });

  test("continues resizing outside the canvas and ends on window release", () => {
    const { manager, canvas, overlay } = selectedCanvas();
    canvas.dispatchEvent(mouseEvent("mousedown", 104, 104));
    canvas.dispatchEvent(new MouseEvent("mouseleave"));
    window.dispatchEvent(mouseEvent("mousemove", 220, 220));
    assertOutline(overlay, { x: 2, y: 2, width: 32, height: 32 });
    window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    assertOutline(overlay, { x: 2, y: 2, width: 6, height: 6 });
    assert.equal(visibleHandles(overlay).length, 4);
    manager.destroy();
  });

  test("keeps an overflowing selection on no-op or empty resize", () => {
    const { manager, canvas, overlay } = selectedCanvas();
    stroke(canvas, [[98, 98], [114, 98]]);
    const rect = { x: 6, y: 2, width: 3, height: 3 };
    assertOutline(overlay, rect);
    const depth = manager.undoDepth();
    stroke(canvas, [[120, 104], [124, 108], [120, 104]]);
    assertOutline(overlay, rect);
    stroke(canvas, [[108, 92], [120, 96]]);
    assertOutline(overlay, rect);
    assert.equal(manager.tools.select.hasSelection, true);
    assert.equal(manager.undoDepth(), depth);
    manager.destroy();
  });

  for (const interruption of ["mode", "shape", "texture", "blur"]) {
    test(`cleans the resize preview on ${interruption}`, () => {
      const { manager, canvas, overlay } = selectedCanvas();
      let idle = 0;
      manager.selectionEvents.on("selection-idle", () => idle++);
      canvas.dispatchEvent(mouseEvent("mousedown", 104, 104));
      canvas.dispatchEvent(mouseEvent("mousemove", 108, 108));
      switch (interruption) {
        case "mode":
          manager.mode = "paint";
          break;
        case "shape":
          manager.tools.select.shape = true;
          break;
        case "texture":
          manager.clearTexture();
          break;
        case "blur":
          window.dispatchEvent(new Event("blur"));
          break;
      }
      assert.equal(idle, 1);
      assert.equal(manager.tools.select.hasSelection, interruption === "blur");
      assert.equal(visibleHandles(overlay).length, interruption === "blur" ? 4 : 0);
      manager.destroy();
    });
  }

  test("handles follow the viewport at a fixed screen size", () => {
    const { manager, canvas, overlay } = selectedCanvas();
    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 1,
      clientX: 100,
      clientY: 100
    }));
    window.dispatchEvent(new MouseEvent("mousemove", {
      clientX: 120,
      clientY: 110
    }));
    window.dispatchEvent(new MouseEvent("mouseup", { button: 1 }));
    const handle = visibleHandles(overlay)[0];
    assert.equal(handle.getAttribute("x"), "108.5");
    assert.equal(handle.getAttribute("y"), "98.5");
    stubRect(canvas, { width: 200, height: 200 });
    canvas.dispatchEvent(wheel({ deltaY: -500, clientX: 100, clientY: 100 }));
    for (const square of visibleHandles(overlay)) {
      assert.equal(square.getAttribute("width"), "7");
      assert.equal(square.getAttribute("height"), "7");
    }
    const screen = manager.viewport.toScreen({ x: 2, y: 2 });
    assert.equal(handle.getAttribute("x"), String(screen.x - 3.5));
    assert.equal(handle.getAttribute("y"), String(screen.y - 3.5));
    canvas.dispatchEvent(mouseEvent("mousemove", screen.x, screen.y));
    assert.equal(canvas.style.cursor, "nwse-resize");
    manager.destroy();
  });

  test("shape selections have no handles, normal-view rectangles do", () => {
    const { manager, canvas, overlay } = selectedCanvas();
    manager.tools.select.shape = true;
    canvas.dispatchEvent(mouseEvent("mousedown", 96, 96));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    assert.equal(manager.tools.select.hasSelection, true);
    assert.equal(visibleHandles(overlay).length, 0);
    manager.tools.select.shape = false;
    manager.textureView = "normal";
    stroke(canvas, [[92, 92], [100, 100]]);
    const before = manager.texture;
    stroke(canvas, [[104, 104], [108, 108]]);
    assertOutline(overlay, { x: 2, y: 2, width: 4, height: 4 });
    assert.deepEqual(manager.texture, before);
    assert.equal(manager.tools.select.delete(), false);
    manager.destroy();
  });
});
