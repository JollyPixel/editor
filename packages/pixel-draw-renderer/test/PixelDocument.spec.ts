// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PixelCommand } from "#src/sync/PixelCommand.ts";
import type { UVRegionData } from "#src/uv/region/UVRegion.ts";
import {
  createDocument,
  pixelAt
} from "./helpers/document/document.ts";

// CONSTANTS
const kRed = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};

describe("PixelDocument", () => {
  describe("local edits", () => {
    test("paintPixels paints, records history and emits one command", () => {
      const events: PixelCommand[] = [];
      const doc = createDocument(events);
      let drawEnds = 0;
      doc.on("draw-end", () => drawEnds++);

      doc.paintPixels([{ x: 1, y: 1 }], kRed);

      assert.deepEqual(pixelAt(doc, 1, 1), [255, 0, 0, 255]);
      assert.equal(doc.canUndo, true);
      assert.equal(events.length, 1);
      assert.equal(events[0].action, "stroke");
      assert.equal(drawEnds, 1);
    });

    test("undo restores pixels and emits the replayed commands", () => {
      const events: PixelCommand[] = [];
      const doc = createDocument(events);
      const before = pixelAt(doc, 0, 0);
      doc.paintPixels([{ x: 0, y: 0 }], kRed);
      events.length = 0;

      assert.equal(doc.undo(), true);
      assert.deepEqual(pixelAt(doc, 0, 0), before);
      assert.equal(events.length, 1);
      assert.equal(events[0].action, "stroke");

      assert.equal(doc.redo(), true);
      assert.deepEqual(pixelAt(doc, 0, 0), [255, 0, 0, 255]);
      assert.equal(events.length, 2);
      assert.equal(events[1].action, "stroke");
    });

    test("a UV resize syncs as a state change and undoes in one step", () => {
      const events: PixelCommand[] = [];
      const doc = createDocument(events);
      const region = doc.uv.create({ width: 2, height: 2 });
      events.length = 0;

      doc.uv.resize(region.id, { ...region.bounds, width: 3 });

      assert.deepEqual(
        events.map((event) => event.action),
        ["uv-region-state-changed"]
      );
      doc.undo();
      assert.deepEqual(doc.uv.get(region.id)!.toJSON(), region.toJSON());
      doc.redo();
      assert.equal(doc.uv.get(region.id)!.bounds.width, 3);
    });

    test("emits a command for local edits and none for remote commands", () => {
      const emitted: PixelCommand[] = [];
      const doc = createDocument(emitted);

      doc.paintPixels([{ x: 0, y: 0 }], kRed);
      doc.applyRemoteCommand({
        action: "stroke",
        metadata: { color: kRed, positions: [{ x: 2, y: 3 }] }
      });
      doc.paintPixels([{ x: 1, y: 0 }], kRed);

      assert.deepEqual(emitted.map(({ action }) => action), ["stroke", "stroke"]);
    });

    test("a local edit reaches the history as a step", () => {
      const doc = createDocument();
      const states: boolean[] = [];
      doc.history.on("change", (_scope, state) => states.push(state.canUndo));

      doc.paintPixels([{ x: 0, y: 0 }], kRed);

      assert.deepEqual(states, [true]);
    });
  });

  describe("loadSnapshot", () => {
    test("replaces pixels and UV regions silently and emits a load reset", () => {
      const events: PixelCommand[] = [];
      const doc = createDocument(events);
      const previous = doc.uv.create({ width: 2, height: 2 });
      doc.paintPixels([{ x: 0, y: 0 }], kRed);
      events.length = 0;
      const resets: string[] = [];
      doc.on("reset", (cause) => resets.push(cause));
      const snapshotRegion: UVRegionData = {
        state: "stacked",
        id: "a",
        rect: { x: 0, y: 0, width: 1, height: 1 },
        color: "#f00"
      };

      doc.loadSnapshot(
        { x: 2, y: 1 },
        new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]),
        [snapshotRegion]
      );

      assert.deepEqual(doc.size(), { x: 2, y: 1 });
      assert.deepEqual(pixelAt(doc, 1, 0), [4, 5, 6, 255]);
      assert.equal(doc.uv.get(previous.id), undefined);
      assert.deepEqual(
        [...doc.uv.regions].map((region) => region.id),
        ["a"]
      );
      assert.deepEqual(doc.uv.get("a")?.toJSON(), snapshotRegion);
      assert.equal(events.length, 0);
      assert.deepEqual(resets, ["load"]);
    });
  });
});
