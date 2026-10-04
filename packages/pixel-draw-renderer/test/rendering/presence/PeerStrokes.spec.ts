// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PeerStrokes
} from "#src/rendering/presence/PeerStrokes.ts";
import {
  canvasPixels,
  mockContextOf,
  readPixel
} from "../../fixtures/canvas.ts";
import { makeCanvas } from "../../helpers/dom.ts";
import type { PeerStrokePixel } from "#src/types.ts";

// CONSTANTS
const kRed: PeerStrokePixel = { x: 2, y: 3, color: { r: 255, g: 0, b: 0, a: 255 } };
const kBlue: PeerStrokePixel = { x: 4, y: 5, color: { r: 0, g: 0, b: 255, a: 255 } };
const kGreen: PeerStrokePixel = { x: 6, y: 7, color: { r: 0, g: 255, b: 0, a: 255 } };

describe("PeerStrokes", () => {
  describe("isActive", () => {
    test("is false with no peers, true after set, false after remove", () => {
      const ghosts = new PeerStrokes();
      assert.strictEqual(ghosts.isActive, false);

      ghosts.set("peer-A", [kRed]);
      assert.strictEqual(ghosts.isActive, true);

      ghosts.remove("peer-A");
      assert.strictEqual(ghosts.isActive, false);
    });
  });

  describe("set + draw", () => {
    test("composites every pixel of every peer at its own color", () => {
      const ghosts = new PeerStrokes();
      ghosts.set("peer-A", [kRed, kGreen]);
      ghosts.set("peer-B", [kBlue]);

      const dest = makeCanvas(10);
      ghosts.draw(mockContextOf(dest).asRenderingContext());

      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 2, y: 3 }, dest.width),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 4, y: 5 }, dest.width),
        [0, 0, 255, 255]
      );
      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 6, y: 7 }, dest.width),
        [0, 255, 0, 255]
      );
    });

    test("a later set() for the same peer replaces their pixels entirely", () => {
      const ghosts = new PeerStrokes();
      ghosts.set("peer-A", [kRed]);
      ghosts.set("peer-A", [kBlue]);

      const dest = makeCanvas(10);
      ghosts.draw(mockContextOf(dest).asRenderingContext());

      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 2, y: 3 }, dest.width),
        [0, 0, 0, 0],
        "the old pixel is gone"
      );
      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 4, y: 5 }, dest.width),
        [0, 0, 255, 255]
      );
    });
  });

  describe("remove", () => {
    test("drops that peer's pixels", () => {
      const ghosts = new PeerStrokes();
      ghosts.set("peer-A", [kRed]);
      ghosts.remove("peer-A");

      const dest = makeCanvas(10);
      ghosts.draw(mockContextOf(dest).asRenderingContext());

      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 2, y: 3 }, dest.width),
        [0, 0, 0, 0]
      );
    });
  });

  describe("clearAll", () => {
    test("drops every peer's pixels", () => {
      const ghosts = new PeerStrokes();
      ghosts.set("peer-A", [kRed]);
      ghosts.set("peer-B", [kBlue]);
      ghosts.clearAll();

      assert.strictEqual(ghosts.isActive, false);
    });
  });

  describe("removeOverlapping", () => {
    test("clears whichever peer's ghost shares a pixel, regardless of clientId", () => {
      const ghosts = new PeerStrokes();
      ghosts.set("peer-A", [kRed]);

      ghosts.removeOverlapping([{ x: 2, y: 3 }]);

      assert.strictEqual(ghosts.isActive, false);
    });

    test("leaves peers with no overlapping pixel untouched", () => {
      const ghosts = new PeerStrokes();
      ghosts.set("peer-A", [kRed]);
      ghosts.set("peer-B", [kBlue]);

      ghosts.removeOverlapping([{ x: 2, y: 3 }]);

      const dest = makeCanvas(10);
      ghosts.draw(mockContextOf(dest).asRenderingContext());
      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 2, y: 3 }, dest.width),
        [0, 0, 0, 0],
        "peer-A cleared"
      );
      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 4, y: 5 }, dest.width),
        [0, 0, 255, 255],
        "peer-B untouched"
      );
    });
  });

  describe("changed signal", () => {
    test("emits on set and on remove of a known peer", () => {
      const ghosts = new PeerStrokes();
      let count = 0;
      ghosts.on("changed", () => count++);

      ghosts.set("peer-A", [kRed]);
      assert.strictEqual(count, 1);

      ghosts.remove("peer-A");
      assert.strictEqual(count, 2);
    });

    test("does not emit removing an unknown peer", () => {
      const ghosts = new PeerStrokes();
      let count = 0;
      ghosts.on("changed", () => count++);

      ghosts.remove("unknown");
      assert.strictEqual(count, 0);
    });
  });
});
