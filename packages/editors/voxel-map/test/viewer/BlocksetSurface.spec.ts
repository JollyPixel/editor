// Import Node.js Dependencies
import {
  describe,
  it,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import type { BlocksetDocument } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlocksetSurface } from "../../src/viewer/BlocksetSurface.ts";
import { FakeFrames } from "../helpers/frames.ts";

function setup(
  t: TestContext
) {
  const frames = new FakeFrames(t);
  const pixels = Object.assign(
    new Emitter<Record<string, (...args: unknown[]) => void>>(),
    { normalMap: null }
  );
  const surface = new BlocksetSurface({
    pixels: pixels as unknown as PixelDocument,
    blockset: new Emitter() as unknown as BlocksetDocument
  });
  const seen: Array<[string, unknown?]> = [];
  surface.on("reset", () => seen.push(["reset"]));
  surface.on("changed", (bounds) => seen.push(["changed", bounds]));
  surface.on("settled", (bounds) => seen.push(["settled", bounds]));

  return { frames, pixels, surface, seen };
}

describe("BlocksetSurface", () => {
  it("reports each frame of a burst, then settles its union on a quiet frame", (t) => {
    const { frames, pixels, seen } = setup(t);

    pixels.emit("changed", { bounds: { x: 0, y: 0, width: 4, height: 4 } });
    pixels.emit("changed", { bounds: { x: 4, y: 0, width: 4, height: 4 } });
    frames.run();
    pixels.emit("changed", { bounds: { x: 8, y: 8, width: 4, height: 4 } });
    frames.run();
    frames.run();

    assert.deepEqual(seen, [
      ["changed", { x: 0, y: 0, width: 8, height: 4 }],
      ["changed", { x: 8, y: 8, width: 4, height: 4 }],
      ["settled", { x: 0, y: 0, width: 12, height: 12 }]
    ]);
    assert.equal(frames.length, 0);
  });

  it("resets once in place of the burst it interrupts", (t) => {
    const { frames, pixels, seen } = setup(t);

    pixels.emit("changed", { bounds: { x: 0, y: 0, width: 4, height: 4 } });
    frames.run();
    pixels.emit("resized");
    frames.run();

    assert.deepEqual(seen, [
      ["changed", { x: 0, y: 0, width: 4, height: 4 }],
      ["reset"]
    ]);
    assert.equal(frames.length, 0);
  });

  it("schedules nothing once disposed", (t) => {
    const { frames, pixels, surface } = setup(t);

    surface.dispose();
    pixels.emit("changed", { bounds: { x: 0, y: 0, width: 4, height: 4 } });

    assert.equal(frames.length, 0);
  });
});
