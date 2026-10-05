// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import type { Mode } from "#src/types.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import { mouseEvent } from "./helpers/events.ts";

describe("PixelArtCanvas select all", () => {
  for (const size of [{ x: 5, y: 3 }, { x: 1, y: 1 }]) {
    test(`selects all ${size.x}×${size.y} pixels without editing the texture`, () => {
      const commands: unknown[] = [];
      const { manager, canvas } = createPixelArtCanvas({
        texture: { size, defaultColor: "#00000000" },
        zoom: { default: 16 },
        history: { enabled: true },
        onCommand: (command) => commands.push(command)
      }, 32);
      manager.mode = "select";
      manager.tools.select.shape = true;
      manager.shortcuts.panHeld = true;
      canvas.dispatchEvent(mouseEvent("mousedown", 16, 16));
      window.dispatchEvent(mouseEvent("mousemove", 28, 24));
      window.dispatchEvent(new MouseEvent("mouseup"));
      manager.shortcuts.panHeld = false;
      const pixels = manager.document.buffer.pixels().slice();
      const states: unknown[] = [];
      manager.selectionEvents.on("selection-state-changed", (state) => {
        states.push(state);
      });

      assert.equal(manager.shortcuts.selectAll(), true);
      assert.deepEqual(manager.selectionPresence?.toJSON(), {
        phase: "selected",
        rect: { x: 0, y: 0, width: size.x, height: size.y },
        mask: Array(size.x * size.y).fill(true)
      });
      assert.equal(manager.tools.select.shape, true);
      assert.equal(manager.tools.select.isFloating, false);
      assert.equal(canvas.style.cursor, "grab");
      assert.deepEqual(states, [{ hasSelection: true, isFloating: false }]);
      assert.equal(manager.shortcuts.selectAll(), true);
      assert.deepEqual(states, [{ hasSelection: true, isFloating: false }]);
      assert.deepEqual(manager.document.buffer.pixels(), pixels);
      assert.deepEqual(commands, []);
      assert.equal(manager.undoDepth(), 0);
      manager.destroy();
    });
  }

  test("only select mode handles select all", () => {
    const { manager } = createPixelArtCanvas();
    const modes: Mode[] = ["paint", "erase", "move", "fill", "uv"];
    for (const mode of modes) {
      manager.mode = mode;
      assert.equal(manager.shortcuts.selectAll(), false);
      assert.equal(manager.selectionPresence, null);
    }
    manager.destroy();
  });

  test("replaces a selection and uses the current size after resizing", () => {
    const { manager, canvas } = createPixelArtCanvas({
      zoom: { default: 4 }
    });
    manager.mode = "select";
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 100, 96));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    assert.equal(manager.tools.select.hasSelection, true);

    assert.equal(manager.shortcuts.selectAll(), true);
    assert.deepEqual(manager.selectionPresence?.toJSON(), {
      phase: "selected",
      rect: { x: 0, y: 0, width: 8, height: 8 },
      mask: Array(64).fill(true)
    });
    manager.textureSize = { x: 3, y: 2 };
    assert.equal(manager.shortcuts.selectAll(), true);
    assert.deepEqual(manager.selectionPresence?.toJSON(), {
      phase: "selected",
      rect: { x: 0, y: 0, width: 3, height: 2 },
      mask: Array(6).fill(true)
    });
    manager.destroy();
  });

  for (const gesture of ["creating", "moving", "resizing"] as const) {
    test(`keeps an active ${gesture} gesture intact`, () => {
      const { manager, canvas } = createPixelArtCanvas({
        zoom: { default: 4 }
      });
      manager.mode = "select";
      if (gesture !== "creating") {
        manager.shortcuts.selectAll();
      }
      const coordinate = gesture === "resizing" ? 84 : 100;
      canvas.dispatchEvent(mouseEvent("mousedown", coordinate, coordinate));
      canvas.dispatchEvent(mouseEvent("mousemove", coordinate + 8, coordinate));
      const presence = manager.selectionPresence?.toJSON();
      assert.equal(presence?.phase, gesture);

      assert.equal(manager.shortcuts.selectAll(), false);
      assert.deepEqual(manager.selectionPresence?.toJSON(), presence);
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      assert.equal(manager.selectionPresence?.toJSON().phase, "selected");
      manager.destroy();
    });
  }

  test("selects all in the normal view while refusing pixel edits", () => {
    const { manager } = createPixelArtCanvas();
    manager.textureView = "normal";
    manager.mode = "select";

    assert.equal(manager.shortcuts.selectAll(), true);
    assert.equal(manager.tools.select.hasSelection, true);
    assert.equal(manager.shortcuts.delete(), false);
    assert.equal(manager.shortcuts.rotate("cw"), false);
    manager.destroy();
  });

  test("deposits a floating paste before capturing all pixels", async() => {
    const { manager } = createPixelArtCanvas({
      clipboard: null,
      history: { enabled: true }
    });
    manager.mode = "select";
    manager.brush.primary.set("#ff0000", 1);
    manager.commitPixels([{ x: 2, y: 2 }]);
    manager.shortcuts.selectAll();
    await manager.copySelection();
    manager.brush.primary.set("#0000ff", 1);
    manager.commitPixels([{ x: 2, y: 2 }]);
    await manager.pasteClipboard();
    assert.equal(manager.tools.select.isFloating, true);
    const depth = manager.undoDepth();

    assert.equal(manager.shortcuts.selectAll(), true);
    assert.equal(manager.tools.select.isFloating, false);
    assert.deepEqual(manager.document.buffer.samplePixels([{ x: 2, y: 2 }]), [
      { r: 255, g: 0, b: 0, a: 255 }
    ]);
    assert.equal(manager.undoDepth(), depth + 1);
    await manager.copySelection();
    await manager.pasteClipboard();
    const floating = manager.selectionPresence?.toJSON();
    assert.equal(floating?.phase, "floating");
    if (floating?.phase === "floating") {
      assert.deepEqual(floating.pixels[18], { r: 255, g: 0, b: 0, a: 255 });
    }
    manager.destroy();
  });
});
