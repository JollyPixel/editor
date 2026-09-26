// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { fromUint8Array } from "js-base64";

// Import Internal Dependencies
import { PixelDocument } from "#src/PixelDocument.ts";
import type { PixelBufferHookEvent } from "#src/buffer/hooks.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";

// CONSTANTS
const kRed = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};

function createDocument(
  events: PixelBufferHookEvent[] = []
): PixelDocument {
  return new PixelDocument({
    size: { x: 4, y: 4 },
    history: { enabled: true },
    onBufferUpdated: (event) => events.push(event)
  });
}

function pixelAt(
  doc: PixelDocument,
  x: number,
  y: number
): number[] {
  return [...doc.buffer.samplePixel(x, y)];
}

describe("PixelDocument", () => {
  describe("local edits", () => {
    test("commitPixels paints, records history and emits one hook", () => {
      const events: PixelBufferHookEvent[] = [];
      const doc = createDocument(events);
      let drawEnds = 0;
      doc.on("draw-end", () => drawEnds++);

      doc.commitPixels([{ x: 1, y: 1 }], kRed);

      assert.deepEqual(pixelAt(doc, 1, 1), [255, 0, 0, 255]);
      assert.equal(doc.history.canUndo, true);
      assert.equal(events.length, 1);
      assert.equal(events[0].action, "stroke");
      assert.equal(drawEnds, 1);
    });

    test("undo restores pixels and emits the replay hooks", () => {
      const events: PixelBufferHookEvent[] = [];
      const doc = createDocument(events);
      const before = pixelAt(doc, 0, 0);
      doc.commitPixels([{ x: 0, y: 0 }], kRed);
      events.length = 0;

      const entry = doc.undo();

      assert.equal(entry?.action, "stroke");
      assert.deepEqual(pixelAt(doc, 0, 0), before);
      assert.equal(events.length, 1);
      assert.equal(events[0].action, "stroke");
      assert.equal(doc.redo()?.action, "stroke");
      assert.deepEqual(pixelAt(doc, 0, 0), [255, 0, 0, 255]);
    });

    test("forwards history changes as an event", () => {
      const doc = createDocument();
      const states: boolean[] = [];
      doc.on("history-changed", (state) => states.push(state.canUndo));

      doc.commitPixels([{ x: 0, y: 0 }], kRed);

      assert.deepEqual(states, [true]);
    });
  });

  describe("remote commands", () => {
    test("applies a stroke without echoing a hook or recording history", () => {
      const events: PixelBufferHookEvent[] = [];
      const doc = createDocument(events);
      let changed = 0;
      doc.on("changed", () => changed++);

      doc.applyRemoteCommand({
        action: "stroke",
        metadata: { color: kRed, positions: [{ x: 2, y: 3 }] }
      });

      assert.deepEqual(pixelAt(doc, 2, 3), [255, 0, 0, 255]);
      assert.equal(events.length, 0);
      assert.equal(doc.history.canUndo, false);
      assert.equal(changed, 1);
    });

    test("a remote resize emits resized then reset", () => {
      const doc = createDocument();
      const order: string[] = [];
      doc.on("resized", () => order.push("resized"));
      doc.on("reset", () => order.push("reset"));

      doc.applyRemoteCommand({
        action: "resized",
        metadata: { size: { x: 8, y: 2 } }
      });

      assert.deepEqual(doc.size(), { x: 8, y: 2 });
      assert.deepEqual(order, ["resized", "reset"]);
    });

    test("a remote texture replacement emits replaced then reset", () => {
      const doc = createDocument();
      const order: string[] = [];
      doc.on("replaced", (event) => order.push(`replaced:${event.size.x}`));
      doc.on("reset", () => order.push("reset"));
      const pixels = new Uint8Array(2 * 2 * 4).fill(255);

      doc.applyRemoteCommand({
        action: "texture-replaced",
        metadata: {
          size: { x: 2, y: 2 },
          pixels: fromUint8Array(pixels)
        }
      });

      assert.deepEqual(pixelAt(doc, 1, 1), [255, 255, 255, 255]);
      assert.deepEqual(order, ["replaced:2", "reset"]);
    });
  });

  describe("disownUvRegions", () => {
    function isExternal(
      id: string
    ): boolean {
      return id.startsWith("ext:");
    }

    function stackedRegion(
      id: string
    ) {
      return {
        state: "stacked" as const,
        id,
        rect: { x: 0, y: 0, width: 1, height: 1 },
        color: "#f00"
      };
    }

    test("owns every region by default", () => {
      const doc = createDocument();

      assert.equal(doc.ownsUvRegion("any"), true);
    });

    test("takes the regions back once every filter is released", () => {
      const doc = createDocument();
      const releaseExternal = doc.disownUvRegions(isExternal);
      const releaseA = doc.disownUvRegions((id) => id === "ext:a");

      releaseExternal();
      assert.equal(doc.ownsUvRegion("ext:a"), false);
      assert.equal(doc.ownsUvRegion("ext:b"), true);

      releaseA();
      assert.equal(doc.ownsUvRegion("ext:a"), true);
    });

    test("edits an external region without commands or history", () => {
      const events: PixelBufferHookEvent[] = [];
      const doc = createDocument(events);
      doc.disownUvRegions(isExternal);

      const region = doc.uv.create({
        id: "ext:a",
        width: 4,
        height: 4,
        state: "stacked"
      });
      doc.uv.move(region.id, { x: 2, y: 2, width: 4, height: 4 });
      assert.equal(doc.uv.rotate(region.id, "cw"), true);
      assert.equal(doc.uv.setState(region.id, "unfolded"), true);
      doc.uv.delete(region.id);

      assert.equal(doc.uv.get(region.id), undefined);
      assert.equal(doc.history.canUndo, false);
      assert.deepEqual(events, []);
    });

    test("keeps commands for owned regions and pixel edits", () => {
      const events: PixelBufferHookEvent[] = [];
      const doc = createDocument(events);
      doc.disownUvRegions(isExternal);

      doc.uv.create({
        id: "ext:a",
        width: 4,
        height: 4
      });
      doc.uv.create({
        id: "own",
        width: 4,
        height: 4
      });
      doc.commitPixels([{ x: 0, y: 0 }], kRed);

      assert.deepEqual(
        events.map((event) => event.action),
        ["uv-region-created", "stroke"]
      );
    });

    test("ignores remote commands and snapshot regions for external regions", () => {
      const doc = createDocument();
      doc.disownUvRegions(isExternal);
      doc.uv.create({
        id: "ext:kept",
        width: 4,
        height: 4
      });

      doc.applyRemoteCommand({
        action: "uv-region-created",
        metadata: { region: stackedRegion("ext:remote") }
      });
      doc.applyRemoteCommand({
        action: "uv-region-deleted",
        metadata: { id: "ext:kept" }
      });
      doc.loadSnapshot(
        { x: 1, y: 1 },
        new Uint8ClampedArray([1, 2, 3, 255]),
        [
          stackedRegion("ext:stored"),
          stackedRegion("own")
        ]
      );

      assert.deepEqual(
        [...doc.uv.regions].map((region) => region.id).sort(),
        ["ext:kept", "own"]
      );
      assert.deepEqual(pixelAt(doc, 0, 0), [1, 2, 3, 255]);
    });
  });

  describe("loadSnapshot", () => {
    test("replaces pixels and UV regions, clears history, emits reset", () => {
      const events: PixelBufferHookEvent[] = [];
      const doc = createDocument(events);
      doc.commitPixels([{ x: 0, y: 0 }], kRed);
      events.length = 0;
      let resets = 0;
      doc.on("reset", () => resets++);

      doc.loadSnapshot(
        { x: 2, y: 1 },
        new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]),
        [
          {
            state: "stacked",
            id: "a",
            rect: { x: 0, y: 0, width: 1, height: 1 },
            color: "#f00"
          }
        ]
      );

      assert.deepEqual(doc.size(), { x: 2, y: 1 });
      assert.deepEqual(pixelAt(doc, 1, 0), [4, 5, 6, 255]);
      assert.equal(doc.uv.get("a")?.id, "a");
      assert.equal(doc.history.canUndo, false);
      assert.equal(events.length, 0);
      assert.equal(resets, 1);
    });
  });
});

describe("PixelArtCanvas built on an existing PixelDocument", () => {
  test("shares the document instead of creating one", () => {
    const doc = createDocument();
    const { manager } = createPixelArtCanvas({ document: doc });

    assert.equal(manager.document, doc);
    assert.equal(manager.uv, doc.uv);
    assert.deepEqual(manager.textureSize, { x: 4, y: 4 });
  });

  test("follows a remote resize of the shared document", () => {
    const doc = createDocument();
    const { manager } = createPixelArtCanvas({ document: doc });

    doc.applyRemoteCommand({
      action: "resized",
      metadata: { size: { x: 6, y: 6 } }
    });

    assert.deepEqual(manager.textureSize, { x: 6, y: 6 });
  });

  test("forwards document draw-end and history changes to its callbacks", () => {
    const doc = createDocument();
    let drawEnds = 0;
    let historyChanges = 0;
    const { manager } = createPixelArtCanvas({
      document: doc,
      onDrawEnd: () => drawEnds++,
      onHistoryChange: () => historyChanges++
    });

    doc.commitPixels([{ x: 0, y: 0 }], kRed);
    manager.destroy();
    doc.commitPixels([{ x: 1, y: 0 }], kRed);

    assert.equal(drawEnds, 1);
    assert.equal(historyChanges, 1);
  });

  test("undo on one canvas reverts the edit for every canvas on the document", () => {
    const doc = createDocument();
    const first = createPixelArtCanvas({ document: doc });
    const second = createPixelArtCanvas({ document: doc });
    const before = pixelAt(doc, 3, 3);

    first.manager.commitPixels([{ x: 3, y: 3 }]);
    assert.equal(second.manager.canUndo(), true);

    second.manager.undo();

    assert.deepEqual(pixelAt(doc, 3, 3), before);
    assert.equal(first.manager.canUndo(), false);
  });
});
