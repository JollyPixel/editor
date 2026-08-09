// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PeerStrokeGhosts
} from "#src/rendering/overlays/PeerStrokeGhosts.ts";
import {
  mockContextOf
} from "../../fixtures/canvas.ts";
import type { PeerStrokePixel } from "#src/types.ts";

// CONSTANTS
const kRed: PeerStrokePixel = { x: 2, y: 3, color: { r: 255, g: 0, b: 0, a: 255 } };
const kBlue: PeerStrokePixel = { x: 4, y: 5, color: { r: 0, g: 0, b: 255, a: 255 } };

function makeDest(): HTMLCanvasElement {
  const dest = document.createElement("canvas");
  dest.width = 10;
  dest.height = 10;

  return dest;
}

function pixelAt(
  canvas: HTMLCanvasElement,
  x: number,
  y: number
): [number, number, number, number] {
  const pixels = mockContextOf(canvas).pixels;
  const index = ((y * canvas.width) + x) * 4;

  return [
    pixels[index],
    pixels[index + 1],
    pixels[index + 2],
    pixels[index + 3]
  ];
}

describe("PeerStrokeGhosts", () => {
  describe("isActive", () => {
    test("is false with no peers, true after set, false after remove", () => {
      const ghosts = new PeerStrokeGhosts();
      assert.strictEqual(ghosts.isActive, false);

      ghosts.set("peer-A", [kRed]);
      assert.strictEqual(ghosts.isActive, true);

      ghosts.remove("peer-A");
      assert.strictEqual(ghosts.isActive, false);
    });
  });

  describe("set + draw", () => {
    test("blits a peer's pixels at their own color", () => {
      const ghosts = new PeerStrokeGhosts();
      ghosts.set("peer-A", [kRed, kBlue]);

      const dest = makeDest();
      ghosts.draw(mockContextOf(dest).asRenderingContext());

      assert.deepStrictEqual(pixelAt(dest, 2, 3), [255, 0, 0, 255]);
      assert.deepStrictEqual(pixelAt(dest, 4, 5), [0, 0, 255, 255]);
    });

    test("composites pixels from multiple peers", () => {
      const ghosts = new PeerStrokeGhosts();
      ghosts.set("peer-A", [kRed]);
      ghosts.set("peer-B", [kBlue]);

      const dest = makeDest();
      ghosts.draw(mockContextOf(dest).asRenderingContext());

      assert.deepStrictEqual(pixelAt(dest, 2, 3), [255, 0, 0, 255]);
      assert.deepStrictEqual(pixelAt(dest, 4, 5), [0, 0, 255, 255]);
    });

    test("a later set() for the same peer replaces their pixels entirely", () => {
      const ghosts = new PeerStrokeGhosts();
      ghosts.set("peer-A", [kRed]);
      ghosts.set("peer-A", [kBlue]);

      const dest = makeDest();
      ghosts.draw(mockContextOf(dest).asRenderingContext());

      assert.deepStrictEqual(pixelAt(dest, 2, 3), [0, 0, 0, 0], "the old pixel is gone");
      assert.deepStrictEqual(pixelAt(dest, 4, 5), [0, 0, 255, 255]);
    });
  });

  describe("remove", () => {
    test("drops that peer's pixels", () => {
      const ghosts = new PeerStrokeGhosts();
      ghosts.set("peer-A", [kRed]);
      ghosts.remove("peer-A");

      const dest = makeDest();
      ghosts.draw(mockContextOf(dest).asRenderingContext());

      assert.deepStrictEqual(pixelAt(dest, 2, 3), [0, 0, 0, 0]);
    });

    test("is a no-op for an unknown peer", () => {
      const ghosts = new PeerStrokeGhosts();
      assert.doesNotThrow(() => ghosts.remove("unknown"));
    });
  });

  describe("clearAll", () => {
    test("drops every peer's pixels", () => {
      const ghosts = new PeerStrokeGhosts();
      ghosts.set("peer-A", [kRed]);
      ghosts.set("peer-B", [kBlue]);
      ghosts.clearAll();

      assert.strictEqual(ghosts.isActive, false);
    });
  });

  describe("removeOverlapping", () => {
    test("clears whichever peer's ghost shares a pixel, regardless of clientId", () => {
      const ghosts = new PeerStrokeGhosts();
      ghosts.set("peer-A", [kRed]);

      ghosts.removeOverlapping([{ x: 2, y: 3 }]);

      assert.strictEqual(ghosts.isActive, false);
    });

    test("leaves peers with no overlapping pixel untouched", () => {
      const ghosts = new PeerStrokeGhosts();
      ghosts.set("peer-A", [kRed]);
      ghosts.set("peer-B", [kBlue]);

      ghosts.removeOverlapping([{ x: 2, y: 3 }]);

      const dest = makeDest();
      ghosts.draw(mockContextOf(dest).asRenderingContext());
      assert.deepStrictEqual(pixelAt(dest, 2, 3), [0, 0, 0, 0], "peer-A cleared");
      assert.deepStrictEqual(pixelAt(dest, 4, 5), [0, 0, 255, 255], "peer-B untouched");
    });

    test("is a no-op for an empty or non-overlapping position list", () => {
      const ghosts = new PeerStrokeGhosts();
      ghosts.set("peer-A", [kRed]);

      ghosts.removeOverlapping([]);
      assert.strictEqual(ghosts.isActive, true);

      ghosts.removeOverlapping([{ x: 99, y: 99 }]);
      assert.strictEqual(ghosts.isActive, true);
    });
  });

  describe("changed signal", () => {
    test("emits on set and on remove of a known peer", () => {
      const ghosts = new PeerStrokeGhosts();
      let count = 0;
      ghosts.on("changed", () => count++);

      ghosts.set("peer-A", [kRed]);
      assert.strictEqual(count, 1);

      ghosts.remove("peer-A");
      assert.strictEqual(count, 2);
    });

    test("does not emit removing an unknown peer", () => {
      const ghosts = new PeerStrokeGhosts();
      let count = 0;
      ghosts.on("changed", () => count++);

      ghosts.remove("unknown");
      assert.strictEqual(count, 0);
    });
  });
});
