// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelDocument } from "#src/PixelDocument.ts";
import { IslandMap } from "#src/normal/IslandMap.ts";
import { NormalMapConfig } from "#src/normal/NormalMapConfig.ts";
import { NormalMapGenerator } from "#src/normal/NormalMapGenerator.ts";
import type { SelectionRect } from "#src/types.ts";
import { FakeFrames } from "../helpers/frames.ts";

// CONSTANTS
const kRed = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};

function createDocument(): PixelDocument {
  const doc = new PixelDocument({
    size: { x: 8, y: 8 },
    defaultColor: "#808080"
  });
  doc.enableNormalMap();

  return doc;
}

function expected(
  doc: PixelDocument,
  config = doc.normalMap
): Uint8ClampedArray {
  return NormalMapGenerator.generate({
    size: doc.size(),
    pixels: doc.buffer.pixels(),
    islands: IslandMap.fromRegions(doc.size(), doc.uv.regions),
    config
  });
}

describe("NormalMap", () => {
  test("does no work until a consumer retains it", (t) => {
    const frames = new FakeFrames(t);
    const doc = createDocument();
    const normals = doc.normals;

    doc.commitPixels([{ x: 1, y: 1 }], kRed);

    assert.equal(frames.length, 0);
    assert.equal(normals.pixels.length, 0);
    assert.equal(doc.normals, normals);
  });

  test("retaining generates the whole map on the next frame", (t) => {
    const frames = new FakeFrames(t);
    const doc = createDocument();
    const changes: SelectionRect[] = [];
    doc.normals.on("changed", (event) => changes.push(event.bounds));

    doc.normals.retain();
    frames.run();

    assert.deepEqual(changes, [{ x: 0, y: 0, width: 8, height: 8 }]);
    assert.deepEqual(doc.normals.size, { x: 8, y: 8 });
    assert.deepEqual(doc.normals.pixels, expected(doc));
  });

  test("coalesces strokes into one pass per frame", (t) => {
    const frames = new FakeFrames(t);
    const doc = createDocument();
    doc.normals.retain();
    doc.normals.flush();
    const changes: SelectionRect[] = [];
    doc.normals.on("changed", (event) => changes.push(event.bounds));

    doc.commitPixels([{ x: 2, y: 2 }], kRed);
    doc.commitPixels([{ x: 3, y: 2 }], kRed);
    assert.equal(frames.length, 1);
    frames.run();

    assert.equal(changes.length, 1);
    assert.deepEqual(doc.normals.pixels, expected(doc));
  });

  test("stops tracking the document once every consumer released it", (t) => {
    const frames = new FakeFrames(t);
    const doc = createDocument();
    const releaseA = doc.normals.retain();
    const releaseB = doc.normals.retain();
    doc.normals.flush();

    releaseA();
    releaseA();
    assert.equal(doc.normals.retained, true);
    releaseB();
    doc.commitPixels([{ x: 1, y: 1 }], kRed);

    assert.equal(doc.normals.retained, false);
    assert.equal(frames.length, 0);
    assert.equal(doc.normals.pixels.length, 0);
  });

  test("follows settings, zones and UV changes", (t) => {
    new FakeFrames(t);
    const doc = createDocument();
    doc.normals.retain();
    doc.commitPixels([{ x: 1, y: 1 }, { x: 5, y: 5 }], kRed);
    doc.normals.flush();

    doc.uv.restore({
      id: "tile",
      color: "#fff",
      state: "stacked",
      rect: { x: 0, y: 0, width: 4, height: 4 }
    });
    doc.normals.flush();
    assert.equal(doc.normals.islands.islands.length, 2);
    assert.deepEqual(doc.normals.pixels, expected(doc));

    doc.setNormalMapZone({ regionId: "tile", settings: { invert: true } });
    doc.normals.flush();
    assert.deepEqual(doc.normals.pixels, expected(doc));

    doc.patchNormalMapDefaults({ strength: 6, border: "bevel" });
    doc.normals.flush();
    assert.deepEqual(doc.normals.pixels, expected(doc));

    doc.disableNormalMap();
    doc.normals.flush();
    assert.deepEqual(doc.normals.pixels, expected(doc));
  });

  test("reallocates its output when the texture is resized", (t) => {
    new FakeFrames(t);
    const doc = createDocument();
    const sizes: number[] = [];
    doc.normals.on("resized", (event) => sizes.push(event.size.x));
    doc.normals.retain();
    doc.normals.flush();

    doc.resize({ x: 4, y: 2 });
    doc.normals.flush();

    assert.deepEqual(sizes, [8, 4]);
    assert.equal(doc.normals.pixels.length, 4 * 2 * 4);
    assert.deepEqual(doc.normals.pixels, expected(doc));
  });

  describe("preview", () => {
    test("generates from a previewed config without touching the document", (t) => {
      new FakeFrames(t);
      const events: string[] = [];
      const doc = createDocument();
      doc.onBufferUpdated = (event) => events.push(event.action);
      doc.commitPixels([{ x: 1, y: 1 }], kRed);
      events.length = 0;
      doc.normals.retain();
      const preview = doc.normalMap!.withDefaults({ strength: 8 });

      doc.normals.preview(preview);
      doc.normals.flush();

      assert.equal(doc.normals.config, preview);
      assert.equal(doc.normalMap?.defaults.strength, 2);
      assert.deepEqual(doc.normals.pixels, expected(doc, preview));
      assert.deepEqual(events, []);
    });

    test("a committed change drops the preview on every island", (t) => {
      new FakeFrames(t);
      const doc = createDocument();
      doc.commitPixels([{ x: 1, y: 1 }, { x: 5, y: 5 }], kRed);
      doc.uv.restore({
        id: "tile",
        color: "#fff",
        state: "stacked",
        rect: { x: 0, y: 0, width: 4, height: 4 }
      });
      doc.normals.retain();
      doc.normals.preview(doc.normalMap!.withDefaults({ strength: 8 }));
      doc.normals.flush();

      doc.setNormalMapZone({ regionId: "tile", settings: { invert: true } });
      doc.normals.flush();

      assert.equal(doc.normals.config, doc.normalMap);
      assert.deepEqual(doc.normals.pixels, expected(doc));
    });

    test("clearing the preview restores the committed config", (t) => {
      new FakeFrames(t);
      const doc = createDocument();
      doc.normals.retain();
      doc.normals.preview(doc.normalMap!.withDefaults({ strength: 8 }));

      doc.normals.preview(null);
      doc.normals.flush();

      assert.equal(doc.normals.config, doc.normalMap);
      assert.deepEqual(doc.normals.pixels, expected(doc));
    });

    test("is ignored while the feature is off", () => {
      const doc = createDocument();
      doc.disableNormalMap();

      doc.normals.preview(NormalMapConfig.create());

      assert.equal(doc.normals.config, null);
    });
  });
});
