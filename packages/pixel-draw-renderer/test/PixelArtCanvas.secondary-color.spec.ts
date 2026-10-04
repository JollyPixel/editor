// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";

describe("PixelArtCanvas — secondary color (right-click)", () => {
  function makeManager(
    onBufferUpdated: (event: unknown) => void
  ): PixelArtCanvas {
    return createPixelArtCanvas({
      texture: { size: { x: 16, y: 16 } },
      zoom: { default: 4 },
      brush: {
        size: 1,
        maxSize: 1,
        color: "#000000",
        secondaryColor: "#00FF00"
      },
      onBufferUpdated
    }).manager;
  }

  test("right-click drag paints with the secondary color", () => {
    const events: unknown[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 2,
      buttons: 2,
      clientX: 100,
      clientY: 100,
      bubbles: true
    }));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    assert.strictEqual(events.length, 1);
    const event = events[0] as {
      action: string;
      metadata: {
        color: { r: number; g: number; b: number; a: number; };
      };
    };
    assert.strictEqual(event.action, "stroke");
    assert.deepStrictEqual(
      event.metadata.color,
      { r: 0, g: 255, b: 0, a: 255 },
      "committed color is secondary, not primary"
    );
    manager.destroy();
  });

  test("right-click in fill mode floods with the secondary color, is not tracked as a drag", () => {
    const events: unknown[] = [];
    const { manager, canvas } = createPixelArtCanvas({
      texture: {
        size: { x: 16, y: 16 }
      },
      zoom: { default: 4 },
      defaultMode: "fill",
      brush: {
        color: "#000000",
        secondaryColor: "#00FF00"
      },
      onBufferUpdated: (event) => events.push(event)
    });

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 2,
      buttons: 2,
      clientX: 100,
      clientY: 100,
      bubbles: true
    }));

    assert.strictEqual(events.length, 1, "the flood fill commits on mousedown, no drag/mouseup needed");
    const event = events[0] as {
      action: string;
      metadata: {
        color: { r: number; g: number; b: number; a: number; };
      };
    };
    assert.strictEqual(event.action, "stroke");
    assert.deepStrictEqual(
      event.metadata.color,
      { r: 0, g: 255, b: 0, a: 255 }
    );

    canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        buttons: 2,
        clientX: 110,
        clientY: 100,
        bubbles: true
      })
    );
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    assert.strictEqual(events.length, 1, "no secondary drag was tracked, so move/up are no-ops");
    manager.destroy();
  });

  test("Ctrl+Right-click picks the primary color from the canvas and commits no stroke", () => {
    const events: unknown[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    manager.brush.primary.set("#123456");
    manager.commitPixels([{ x: 8, y: 8 }]);
    events.length = 0;
    manager.brush.primary.set("#000000");

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 2,
      buttons: 2,
      clientX: 100,
      clientY: 100,
      ctrlKey: true,
      bubbles: true
    }));

    assert.strictEqual(
      manager.brush.primary.asString("hex"),
      "#123456"
    );
    assert.strictEqual(
      events.length,
      0,
      "picking a color must not commit a stroke"
    );

    canvas.dispatchEvent(new MouseEvent("mousemove", {
      buttons: 2,
      clientX: 110,
      clientY: 100,
      bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.strictEqual(
      events.length,
      0,
      "no drag was tracked for the ctrl+right-click pick"
    );
    manager.destroy();
  });

  test("a primary stroke in progress blocks a secondary stroke from starting", () => {
    const events: unknown[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    canvas.dispatchEvent(
      new MouseEvent("mousedown", {
        button: 0,
        buttons: 1,
        clientX: 100,
        clientY: 100,
        bubbles: true
      })
    );
    canvas.dispatchEvent(
      new MouseEvent("mousedown", {
        button: 2,
        buttons: 3,
        clientX: 110,
        clientY: 100,
        bubbles: true
      })
    );
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    assert.strictEqual(
      events.length,
      1,
      "only the primary stroke committed"
    );
    const event = events[0] as {
      metadata: {
        color: { r: number; g: number; b: number; a: number; };
      };
    };
    assert.deepStrictEqual(
      event.metadata.color,
      { r: 0, g: 0, b: 0, a: 255 },
      "committed color is primary, not secondary"
    );
    manager.destroy();
  });

  test("a secondary stroke in progress blocks a primary stroke from starting", () => {
    const events: unknown[] = [];
    const manager = makeManager((event) => events.push(event));
    const canvas = manager.canvas();

    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 2,
      buttons: 2,
      clientX: 100,
      clientY: 100,
      bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0,
      buttons: 3,
      clientX: 110,
      clientY: 100,
      bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    assert.strictEqual(
      events.length,
      1,
      "only the secondary stroke committed"
    );
    const event = events[0] as {
      metadata: {
        color: { r: number; g: number; b: number; a: number; };
      };
    };
    assert.deepStrictEqual(
      event.metadata.color,
      { r: 0, g: 255, b: 0, a: 255 },
      "committed color is secondary, not primary"
    );
    manager.destroy();
  });
});
