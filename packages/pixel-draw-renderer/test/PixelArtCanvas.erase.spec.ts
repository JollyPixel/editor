// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import type {
  PixelBufferHookEvent
} from "#src/buffer/hooks.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import {
  mouseEvent,
  moveTo,
  shiftKeyDown,
  wheel
} from "./helpers/events.ts";

const kTransparent = {
  r: 0,
  g: 0,
  b: 0,
  a: 0
};

function makeManager(
  events: PixelBufferHookEvent[],
  size = 1
): PixelArtCanvas {
  const { manager } = createPixelArtCanvas({
    texture: {
      size: { x: 16, y: 16 },
      defaultColor: "#FF0000"
    },
    zoom: { default: 4 },
    brush: {
      size,
      maxSize: 8,
      color: "#000000",
      secondaryColor: "#00FF00"
    },
    history: { enabled: true },
    onBufferUpdated: (event) => events.push(event)
  });
  manager.mode = "erase";

  return manager;
}

function stroke(
  canvas: HTMLCanvasElement,
  points: [number, number][],
  button: 0 | 2 = 0
): void {
  const [first, ...rest] = points;
  canvas.dispatchEvent(new MouseEvent("mousedown", {
    button,
    buttons: button === 0 ? 1 : 2,
    clientX: first[0],
    clientY: first[1],
    bubbles: true
  }));
  for (const [clientX, clientY] of rest) {
    canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        button,
        buttons: button === 0 ? 1 : 2,
        clientX,
        clientY,
        bubbles: true
      })
    );
  }
  canvas.dispatchEvent(
    new MouseEvent("mouseup", { bubbles: true })
  );
}

function strokedPositions(
  event: PixelBufferHookEvent
): { x: number; y: number; }[] {
  assert.strictEqual(event.action, "stroke");

  return event.metadata.positions;
}

describe("PixelArtCanvas — erase mode", () => {
  test("a drag clears pixels to transparent instead of painting", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager(events);

    stroke(manager.canvas(), [[100, 100], [108, 100]]);

    const positions = strokedPositions(events[0]);
    assert.ok(positions.length > 1, "the drag covers more than one pixel");
    for (const { x, y } of positions) {
      assert.deepStrictEqual(
        manager.document.buffer.samplePixel(x, y),
        [0, 0, 0, 0]
      );
    }
    assert.deepStrictEqual(
      manager.document.buffer.samplePixel(0, 15),
      [255, 0, 0, 255],
      "pixels outside the stroke keep the texture color"
    );
    manager.destroy();
  });

  test("the committed stroke carries the transparent color", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager(events);

    stroke(manager.canvas(), [[100, 100]]);

    assert.strictEqual(events.length, 1);
    const event = events[0];
    assert.strictEqual(event.action, "stroke");
    assert.deepStrictEqual(event.metadata.color, kTransparent);
    manager.destroy();
  });

  test("right-click erases instead of painting the secondary color", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager(events);

    stroke(manager.canvas(), [[100, 100]], 2);

    assert.strictEqual(events.length, 1);
    const event = events[0];
    const [position] = strokedPositions(event);
    assert.strictEqual(event.action, "stroke");
    assert.deepStrictEqual(event.metadata.color, kTransparent);
    assert.deepStrictEqual(
      manager.document.buffer.samplePixel(position.x, position.y),
      [0, 0, 0, 0]
    );
    manager.destroy();
  });

  test("the brush size drives the erased footprint", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager(events, 4);

    stroke(manager.canvas(), [[100, 100]]);

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].action, "stroke");
    assert.strictEqual(
      events[0].metadata.positions.length,
      16,
      "a size 4 brush erases a 4x4 block"
    );
    manager.destroy();
  });

  test("undo restores the erased colors", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager(events);

    stroke(manager.canvas(), [[100, 100]]);
    const [position] = strokedPositions(events[0]);
    assert.strictEqual(manager.undo(), true);

    assert.deepStrictEqual(
      manager.document.buffer.samplePixel(position.x, position.y),
      [255, 0, 0, 255]
    );
    manager.destroy();
  });

  test("Shift arms a line that erases on mousedown", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager(events);
    const canvas = manager.canvas();

    moveTo(canvas, 100, 100);
    window.dispatchEvent(shiftKeyDown());
    moveTo(canvas, 128, 100);
    canvas.dispatchEvent(mouseEvent("mousedown", 128, 100));

    assert.strictEqual(events.length, 1);
    const event = events[0];
    assert.strictEqual(event.action, "stroke");
    assert.strictEqual(event.metadata.positions.length, 8);
    assert.deepStrictEqual(event.metadata.color, kTransparent);
    manager.destroy();
  });

  test("Ctrl+wheel resizes the brush like it does in paint mode", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager(events, 4);

    manager.canvas().dispatchEvent(
      wheel({ deltaY: -100, ctrlKey: true })
    );

    assert.strictEqual(manager.brush.size, 5);
    manager.destroy();
  });

  test("leaving erase mode restores brush painting", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager(events);

    stroke(manager.canvas(), [[100, 100]]);
    manager.mode = "paint";
    stroke(manager.canvas(), [[110, 100]]);

    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[1].action, "stroke");
    assert.deepStrictEqual(
      events[1].metadata.color,
      { r: 0, g: 0, b: 0, a: 255 }
    );
    manager.destroy();
  });

  test("brush.eraseColor overrides what erase mode writes", () => {
    const events: PixelBufferHookEvent[] = [];
    const { manager } = createPixelArtCanvas({
      texture: {
        size: { x: 16, y: 16 },
        defaultColor: "#FF0000"
      },
      zoom: { default: 4 },
      brush: {
        size: 1,
        maxSize: 1,
        eraseColor: "#0000FF"
      },
      defaultMode: "erase",
      onBufferUpdated: (event) => events.push(event)
    });

    stroke(manager.canvas(), [[100, 100]]);

    const [position] = strokedPositions(events[0]);
    assert.deepStrictEqual(
      manager.document.buffer.samplePixel(position.x, position.y),
      [0, 0, 255, 255]
    );
    manager.destroy();
  });
});
