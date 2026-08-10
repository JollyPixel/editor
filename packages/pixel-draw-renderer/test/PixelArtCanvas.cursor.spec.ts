// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PeerPresence } from "#src/index.ts";
import type { Vec2 } from "#src/types.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";

describe("PixelArtCanvas — onCursorMove", () => {
  test("reports the bounded texture position on a canvas mousemove", () => {
    const positions: (Vec2 | null)[] = [];
    const { manager, canvas } = createPixelArtCanvas({
      zoom: { default: 4 }
    });
    manager.onCursorMove = (pos) => positions.push(pos);

    // 8x8 texture, zoom 4, 200x200 container -> centered camera (84,84);
    // client(100,100) -> texture floor((100-84)/4) = (4,4).
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      clientX: 100,
      clientY: 100,
      bubbles: true
    }));

    assert.strictEqual(positions.length, 1);
    assert.deepStrictEqual(positions[0], { x: 4, y: 4 });
    manager.destroy();
  });

  test("reports null once the pointer leaves the canvas", () => {
    const positions: (Vec2 | null)[] = [];
    const { manager, canvas } = createPixelArtCanvas({
      zoom: { default: 4 }
    });
    manager.onCursorMove = (pos) => positions.push(pos);

    canvas.dispatchEvent(new MouseEvent("mousemove", {
      clientX: 100,
      clientY: 100,
      bubbles: true
    }));
    canvas.dispatchEvent(new MouseEvent("mouseleave", {
      bubbles: true
    }));

    assert.strictEqual(positions.length, 2);
    assert.strictEqual(positions[1], null);
    manager.destroy();
  });

  test("getter returns whatever handler was last assigned", () => {
    const { manager } = createPixelArtCanvas();
    const positions: (Vec2 | null)[] = [];
    function handler(pos: Vec2 | null): void {
      positions.push(pos);
    }

    assert.strictEqual(manager.onCursorMove, undefined);
    manager.onCursorMove = handler;
    assert.strictEqual(manager.onCursorMove, handler);
    manager.destroy();
  });

  test("does not throw when no listener is attached", () => {
    const { manager, canvas } = createPixelArtCanvas();

    assert.doesNotThrow(() => {
      canvas.dispatchEvent(new MouseEvent("mousemove", {
        clientX: 10,
        clientY: 10,
        bubbles: true
      }));
    });
    manager.destroy();
  });

  test("peerPresence.cursors renders into the canvas's own overlay SVG", () => {
    const { manager, children } = createPixelArtCanvas();
    assert.ok(manager.peerPresence instanceof PeerPresence);
    // children[0] is the interactive canvas, children[1] the SVG overlay
    // (see test/helpers/dom.ts). SelectionOutline also owns <path>s (created
    // eagerly, just hidden), so assert on the delta rather than an absolute count.
    const svg = children[1] as unknown as SVGElement;
    const baseline = svg.querySelectorAll("path").length;

    manager.peerPresence.cursors.set("peer-A", {
      pos: { x: 0, y: 0 },
      color: "#ff0000"
    });
    assert.strictEqual(svg.querySelectorAll("path").length, baseline + 1);

    manager.peerPresence.cursors.remove("peer-A");
    assert.strictEqual(svg.querySelectorAll("path").length, baseline);
    manager.destroy();
  });
});
