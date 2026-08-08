// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import type { PixelBufferHookEvent, PixelBufferHookListener } from "#src/buffer/hooks.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import {
  shiftKeyDown,
  shiftKeyUp,
  moveTo
} from "./helpers/events.ts";

describe("PixelArtCanvas — line tool (Shift)", () => {
  // 200x200 container, 16x16 texture, zoom 4 -> centered camera (68, 68).
  // client(100,100) -> texture (8,8); client(128,100) -> texture (15,8).

  function makeManager(onBufferUpdated: PixelBufferHookListener): PixelArtCanvas {
    return createPixelArtCanvas({
      texture: { size: { x: 16, y: 16 } },
      zoom: { default: 4 },
      brush: { size: 1, maxSize: 1 },
      onBufferUpdated
    }).manager;
  }

  test("Shift-arm-then-mousedown commits a brush-stamped line as a single stroke", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    window.dispatchEvent(shiftKeyDown());
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
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    window.dispatchEvent(shiftKeyDown());
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
    const events: PixelBufferHookEvent[] = [];
    const manager = createPixelArtCanvas({
      texture: { size: { x: 16, y: 16 } },
      zoom: { default: 4 },
      brush: {
        size: 1,
        maxSize: 1,
        color: "#FF0000",
        secondaryColor: "#00FF00"
      },
      onBufferUpdated: (event) => events.push(event)
    }).manager;
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    window.dispatchEvent(shiftKeyDown());
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
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    window.dispatchEvent(shiftKeyDown());
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

  test("holding Shift through a commit re-arms the line from the committed endpoint (chained polyline)", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    window.dispatchEvent(shiftKeyDown());
    moveTo(canvas, 128, 100);

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0, buttons: 1, clientX: 128, clientY: 100, bubbles: true
    }));

    assert.strictEqual(events.length, 1, "first segment committed");

    // Shift is still held (no keyup dispatched): moving and clicking again
    // should chain a second segment starting where the first one ended,
    // without requiring the user to release and re-press Shift.
    moveTo(canvas, 128, 128);
    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0, buttons: 1, clientX: 128, clientY: 128, bubbles: true
    }));

    assert.strictEqual(events.length, 2, "second segment chained without re-pressing Shift");
    const secondEvent = events[1];
    assert.strictEqual(secondEvent.action, "stroke");
    assert.strictEqual(secondEvent.metadata.positions.length, 8, "vertical 8px segment from the first segment's endpoint");
    manager.destroy();
  });

  test("releasing Shift after a commit does not re-arm the line tool", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    window.dispatchEvent(shiftKeyDown());
    moveTo(canvas, 128, 100);

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0, buttons: 1, clientX: 128, clientY: 100, bubbles: true
    }));
    window.dispatchEvent(shiftKeyUp());

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
    assert.notStrictEqual(freehandEvent.metadata.positions.length, 8, "not a rasterized 8px line — a freehand stroke instead");
    manager.destroy();
  });

  test("Shift pressed mid-stroke commits the in-progress stroke, then commits the line on mouseup", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 1, clientX: 110, clientY: 100, bubbles: true
    }));

    window.dispatchEvent(shiftKeyDown());

    assert.strictEqual(events.length, 1, "the in-progress freehand stroke was committed when Shift armed the line");

    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.strictEqual(events.length, 2, "releasing the mouse commits the armed line as a second stroke");
    manager.destroy();
  });

  test("Shift keyup without mousedown cancels the line — nothing committed", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    window.dispatchEvent(shiftKeyDown());
    window.dispatchEvent(shiftKeyUp());

    assert.strictEqual(events.length, 0);
    manager.destroy();
  });

  test("setting mode away from 'paint' cancels an armed line", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    window.dispatchEvent(shiftKeyDown());
    manager.mode = "move";

    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.strictEqual(events.length, 0, "the cancelled line must not commit on the next mouseup");
    manager.destroy();
  });

  test("window blur cancels an armed line", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    window.dispatchEvent(shiftKeyDown());
    window.dispatchEvent(new Event("blur"));

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0, buttons: 1, clientX: 100, clientY: 100, bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.strictEqual(events.length, 1, "after blur cancels the line, mousedown behaves as a normal freehand stroke");
    manager.destroy();
  });

  test("OS key-repeat keydown does not reset the armed startPosition", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    window.dispatchEvent(shiftKeyDown());
    moveTo(canvas, 128, 100);
    window.dispatchEvent(shiftKeyDown(true));

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0, buttons: 1, clientX: 128, clientY: 100, bubbles: true
    }));

    const event = events[0];
    assert.strictEqual(event.action, "stroke");
    assert.strictEqual(event.metadata.positions.length, 8, "start should still be (8,8), not reset by the repeat event");
    manager.destroy();
  });
});
