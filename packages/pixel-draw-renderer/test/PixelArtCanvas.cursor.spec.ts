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
  test("reports the bounded texture position on mousemove, then null on mouseleave", () => {
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
    assert.deepStrictEqual(positions, [{ x: 4, y: 4 }]);

    canvas.dispatchEvent(new MouseEvent("mouseleave", {
      bubbles: true
    }));
    assert.deepStrictEqual(positions, [{ x: 4, y: 4 }, null]);
    manager.destroy();
  });

  test("peerPresence.cursors renders into the canvas's own overlay SVG", () => {
    const { manager, overlay: svg } = createPixelArtCanvas();
    assert.ok(manager.peerPresence instanceof PeerPresence);
    const pathsBeforeCursor = svg.querySelectorAll("path").length;

    manager.peerPresence.cursors.set("peer-A", {
      pos: { x: 0, y: 0 },
      color: "#ff0000"
    });
    assert.strictEqual(
      svg.querySelectorAll("path").length,
      pathsBeforeCursor + 1
    );

    manager.peerPresence.cursors.remove("peer-A");
    assert.strictEqual(
      svg.querySelectorAll("path").length,
      pathsBeforeCursor
    );
    manager.destroy();
  });
});
