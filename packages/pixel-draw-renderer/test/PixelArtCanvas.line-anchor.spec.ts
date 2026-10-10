// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import type { PixelCommand } from "#src/sync/PixelCommand.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import {
  mouseEvent,
  moveTo,
  stroke
} from "./helpers/events.ts";

describe("PixelArtCanvas — line anchor", () => {
  function makeManager(onCommand: (command: PixelCommand) => void): PixelArtCanvas {
    return createPixelArtCanvas({
      texture: { size: { x: 16, y: 16 } },
      zoom: { default: 4 },
      brush: { size: 1, maxSize: 1 },
      onCommand
    }).manager;
  }

  test("Shift retains the last clicked pixel through cancellation and hover", () => {
    const events: PixelCommand[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    stroke(canvas, [[100, 100], [104, 100]]);
    moveTo(canvas, 108, 100);
    manager.shortcuts.lineHeld = true;
    moveTo(canvas, 112, 100);
    manager.shortcuts.lineHeld = false;
    moveTo(canvas, 116, 100);
    manager.shortcuts.lineHeld = true;
    canvas.dispatchEvent(mouseEvent("mousedown", 120, 100));

    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[1].action, "stroke");
    assert.deepStrictEqual(events[1].metadata.positions,
      [8, 9, 10, 11, 12, 13].map((x) => {
        return {
          x,
          y: 8
        };
      }));

    manager.shortcuts.lineHeld = false;
    moveTo(canvas, 120, 108);
    manager.shortcuts.lineHeld = true;
    canvas.dispatchEvent(mouseEvent("mousedown", 120, 112));

    assert.strictEqual(events.length, 3);
    assert.strictEqual(events[2].action, "stroke");
    assert.deepStrictEqual(events[2].metadata.positions,
      [8, 9, 10, 11].map((y) => {
        return {
          x: 13,
          y
        };
      }));
    manager.destroy();
  });

  test("Shift waits for its first cursor position and retains the fallback", () => {
    const events: PixelCommand[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    manager.shortcuts.lineHeld = true;
    moveTo(canvas, 100, 100);
    moveTo(canvas, 108, 100);
    manager.shortcuts.lineHeld = false;
    moveTo(canvas, 112, 100);
    manager.shortcuts.lineHeld = true;
    canvas.dispatchEvent(mouseEvent("mousedown", 116, 100));

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].action, "stroke");
    assert.deepStrictEqual(events[0].metadata.positions,
      [8, 9, 10, 11, 12].map((x) => {
        return {
          x,
          y: 8
        };
      }));
    manager.destroy();
  });

  test("paint and erase share the most recent clicked pixel", () => {
    const events: PixelCommand[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    stroke(canvas, [[100, 100]]);
    manager.mode = "erase";
    moveTo(canvas, 108, 100);
    manager.shortcuts.lineHeld = true;
    canvas.dispatchEvent(mouseEvent("mousedown", 112, 100));

    assert.strictEqual(events[1].action, "stroke");
    assert.deepStrictEqual(events[1].metadata.positions,
      [8, 9, 10, 11].map((x) => {
        return {
          x,
          y: 8
        };
      }));
    assert.strictEqual(events[1].metadata.color.a, 0);

    manager.shortcuts.lineHeld = false;
    stroke(canvas, [[112, 108]]);
    manager.mode = "paint";
    moveTo(canvas, 120, 108);
    manager.shortcuts.lineHeld = true;
    canvas.dispatchEvent(mouseEvent("mousedown", 124, 108));

    const lastEvent = events.at(-1);
    assert.strictEqual(lastEvent?.action, "stroke");
    assert.deepStrictEqual(lastEvent?.metadata.positions,
      [11, 12, 13, 14].map((x) => {
        return {
          x,
          y: 10
        };
      }));
    manager.destroy();
  });

  for (const interaction of ["pick", "pan", "select", "uv", "outside"]) {
    test(`${interaction} clicks and blur preserve the line anchor`, () => {
      const events: PixelCommand[] = [];
      const manager = makeManager((event) => events.push(event));
      const canvas = manager.canvas();

      stroke(canvas, [[100, 100]]);
      switch (interaction) {
        case "pick":
          manager.tools.brush.pickArmed = true;
          stroke(canvas, [[108, 100]]);
          manager.tools.brush.pickArmed = false;
          break;
        case "pan":
          manager.shortcuts.panHeld = true;
          stroke(canvas, [[108, 100]]);
          manager.shortcuts.panHeld = false;
          break;
        case "select":
        case "uv":
          manager.mode = interaction;
          stroke(canvas, [[108, 100]]);
          manager.mode = "paint";
          break;
        case "outside":
          stroke(canvas, [[0, 0]]);
          break;
      }
      window.dispatchEvent(new Event("blur"));
      moveTo(canvas, 112, 100);
      manager.shortcuts.lineHeld = true;
      canvas.dispatchEvent(mouseEvent("mousedown", 116, 100));

      const event = events.at(-1);
      assert.strictEqual(event?.action, "stroke");
      assert.deepStrictEqual(event?.metadata.positions,
        [8, 9, 10, 11, 12].map((x) => {
          return {
            x,
            y: 8
          };
        }));
      manager.destroy();
    });
  }

  for (const change of ["resize", "replace"] as const) {
    test(`texture ${change} clears the line anchor`, () => {
      const events: PixelCommand[] = [];
      const manager = makeManager((event) => events.push(event));
      const canvas = manager.canvas();

      stroke(canvas, [[100, 100]]);
      moveTo(canvas, 108, 100);
      manager.shortcuts.lineHeld = true;
      if (change === "resize") {
        manager.document.resize({ x: 16, y: 16 });
      }
      else {
        const texture = document.createElement("canvas");
        texture.width = 16;
        texture.height = 16;
        manager.document.replaceTexture(texture);
      }
      manager.shortcuts.lineHeld = false;
      moveTo(canvas, 112, 100);
      manager.shortcuts.lineHeld = true;
      canvas.dispatchEvent(mouseEvent("mousedown", 120, 100));

      const event = events.at(-1);
      assert.strictEqual(event?.action, "stroke");
      assert.deepStrictEqual(event?.metadata.positions,
        [11, 12, 13].map((x) => {
          return {
            x,
            y: 8
          };
        }));
      manager.destroy();
    });
  }
});
