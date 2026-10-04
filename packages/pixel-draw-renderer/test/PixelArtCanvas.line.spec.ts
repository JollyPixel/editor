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
import { moveTo } from "./helpers/events.ts";

describe("PixelArtCanvas — line tool (Shift)", () => {
  function makeManager(onCommand: (command: PixelCommand) => void): PixelArtCanvas {
    return createPixelArtCanvas({
      texture: { size: { x: 16, y: 16 } },
      zoom: { default: 4 },
      brush: { size: 1, maxSize: 1 },
      onCommand
    }).manager;
  }

  test("Shift-arm-then-mousedown commits a brush-stamped line as a single stroke", () => {
    const events: PixelCommand[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    manager.shortcuts.lineHeld = true;
    moveTo(canvas, 128, 100);

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0, buttons: 1, clientX: 128, clientY: 100, bubbles: true
    }));

    assert.strictEqual(events.length, 1);
    const event = events[0];
    assert.strictEqual(event.action, "stroke");
    assert.strictEqual(event.metadata.positions.length, 8, "1px brush over an 8px-long horizontal line");
    manager.destroy();
  });

  test("Shift then mousedown with no movement paints a single pixel (zero-length fallback)", () => {
    const events: PixelCommand[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    manager.shortcuts.lineHeld = true;
    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
    }));

    assert.strictEqual(events.length, 1);
    const event = events[0];
    assert.strictEqual(event.action, "stroke");
    assert.strictEqual(event.metadata.positions.length, 1);
    manager.destroy();
  });

  test("Shift-arm-then-right-click commits a line with the secondary color", () => {
    const events: PixelCommand[] = [];
    const manager = createPixelArtCanvas({
      texture: { size: { x: 16, y: 16 } },
      zoom: { default: 4 },
      brush: {
        size: 1,
        maxSize: 1,
        color: "#FF0000",
        secondaryColor: "#00FF00"
      },
      onCommand: (event) => events.push(event)
    }).manager;
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    manager.shortcuts.lineHeld = true;
    moveTo(canvas, 128, 100);

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 2, buttons: 2, clientX: 128, clientY: 100, bubbles: true
    }));

    assert.strictEqual(events.length, 1);
    const event = events[0];
    assert.strictEqual(event.action, "stroke");
    assert.deepStrictEqual(event.metadata.color, { r: 0, g: 255, b: 0, a: 255 });
    assert.strictEqual(event.metadata.positions.length, 8);
    manager.destroy();
  });

  test("committing via mousedown does not chain into a freehand stroke while still held", () => {
    const events: PixelCommand[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    manager.shortcuts.lineHeld = true;
    moveTo(canvas, 128, 100);

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0, buttons: 1, clientX: 128, clientY: 100, bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 1, clientX: 140, clientY: 100, bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.strictEqual(events.length, 1, "no chained freehand stroke after the line commit");
    manager.destroy();
  });

  test(
    "holding Shift through a commit re-arms the line from the committed endpoint (chained polyline)",
    () => {
      const events: PixelCommand[] = [];
      const manager = makeManager((event) => events.push(event));
      const canvas = manager.canvas();

      moveTo(canvas, 100, 100);
      manager.shortcuts.lineHeld = true;
      moveTo(canvas, 128, 100);

      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 128, clientY: 100, bubbles: true
      }));

      assert.strictEqual(events.length, 1, "first segment committed");

      moveTo(canvas, 128, 128);
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        button: 0, buttons: 1, clientX: 128, clientY: 128, bubbles: true
      }));

      assert.strictEqual(events.length, 2, "second segment chained without re-pressing Shift");
      const secondEvent = events[1];
      assert.strictEqual(secondEvent.action, "stroke");
      assert.strictEqual(
        secondEvent.metadata.positions.length,
        8,
        "vertical 8px segment from the first segment's endpoint"
      );
      manager.destroy();
    }
  );

  test("releasing Shift after a commit does not re-arm the line tool", () => {
    const events: PixelCommand[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    manager.shortcuts.lineHeld = true;
    moveTo(canvas, 128, 100);

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0, buttons: 1, clientX: 128, clientY: 100, bubbles: true
    }));
    manager.shortcuts.lineHeld = false;

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0, buttons: 1, clientX: 128, clientY: 128, bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 1, clientX: 140, clientY: 128, bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.strictEqual(events.length, 2, "first is the committed line, second is a normal freehand stroke");
    const freehandEvent = events[1];
    assert.strictEqual(freehandEvent.action, "stroke");
    assert.notStrictEqual(
      freehandEvent.metadata.positions.length,
      8,
      "not a rasterized 8px line — a freehand stroke instead"
    );
    manager.destroy();
  });

  test("Shift pressed mid-stroke commits the in-progress stroke, then commits the line on mouseup", () => {
    const events: PixelCommand[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 1, clientX: 110, clientY: 100, bubbles: true
    }));

    manager.shortcuts.lineHeld = true;

    assert.strictEqual(
      events.length,
      1,
      "the in-progress freehand stroke was committed when Shift armed the line"
    );

    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.strictEqual(events.length, 2, "releasing the mouse commits the armed line as a second stroke");
    manager.destroy();
  });

  test("releasing lineHeld without mousedown cancels the line; the next click is freehand", () => {
    const events: PixelCommand[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    manager.shortcuts.lineHeld = true;
    moveTo(canvas, 128, 100);
    manager.shortcuts.lineHeld = false;
    assert.strictEqual(events.length, 0);

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0, buttons: 1, clientX: 128, clientY: 100, bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.strictEqual(events.length, 1);
    const event = events[0];
    assert.strictEqual(event.action, "stroke");
    assert.deepStrictEqual(event.metadata.positions, [{ x: 15, y: 8 }]);
    manager.destroy();
  });

  test("setting mode away from 'paint' cancels an armed line", () => {
    const events: PixelCommand[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    manager.shortcuts.lineHeld = true;
    manager.mode = "move";

    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    assert.strictEqual(events.length, 0, "the cancelled line must not commit on the next mouseup");

    manager.mode = "paint";
    moveTo(canvas, 128, 100);
    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0, buttons: 1, clientX: 128, clientY: 100, bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.strictEqual(events.length, 1);
    const event = events[0];
    assert.strictEqual(event.action, "stroke");
    assert.deepStrictEqual(event.metadata.positions, [{ x: 15, y: 8 }]);
    manager.destroy();
  });

  test("window blur cancels an armed line", () => {
    const events: PixelCommand[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    manager.shortcuts.lineHeld = true;
    window.dispatchEvent(new Event("blur"));

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.strictEqual(
      events.length,
      1,
      "after blur cancels the line, mousedown behaves as a normal freehand stroke"
    );
    manager.destroy();
  });
});
