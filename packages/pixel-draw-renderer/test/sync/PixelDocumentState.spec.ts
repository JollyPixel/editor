// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";
import { PixelDocumentState } from "#src/sync/PixelDocumentState.ts";
import { NormalMapConfig } from "#src/normal/NormalMapConfig.ts";
import {
  toDocumentCommand,
  type PixelCommand
} from "#src/sync/PixelCommand.ts";
import { createDocument } from "../helpers/document/document.ts";

// CONSTANTS
const kRegion = {
  state: "stacked" as const,
  id: "a",
  rect: { x: 0, y: 0, width: 2, height: 2 },
  color: "#f00"
};

function headless(): PixelDocumentState {
  const state = new PixelDocumentState({
    buffer: new PixelBuffer({ size: { x: 4, y: 4 } })
  });
  state.uv.restore(kRegion);

  return state;
}

describe("PixelDocumentState", () => {
  test("uv-region-moved clamps the region inside the texture", () => {
    const state = headless();

    state.apply({
      action: "uv-region-moved",
      metadata: {
        id: "a",
        face: null,
        rect: { x: 3, y: 3, width: 2, height: 2 }
      }
    });

    assert.deepEqual(state.uv.get("a")?.bounds, { x: 2, y: 2, width: 2, height: 2 });
  });

  test("uv-region-moved moves a stacked region whole even when a slot is named", () => {
    const state = headless();

    state.apply({
      action: "uv-region-moved",
      metadata: {
        id: "a",
        face: "top",
        rect: { x: 1, y: 1, width: 2, height: 2 }
      }
    });

    assert.deepEqual(state.uv.get("a")?.bounds, { x: 1, y: 1, width: 2, height: 2 });
  });

  test("uv-region-deleted removes the region's normal map zone", () => {
    const changes: (string[] | null)[] = [];
    const state = new PixelDocumentState({
      buffer: new PixelBuffer({ size: { x: 4, y: 4 } }),
      onNormalMapChanged: (regionIds) => changes.push(regionIds)
    });
    state.load({
      size: { x: 4, y: 4 },
      pixels: new Uint8ClampedArray(64),
      uvRegions: [kRegion],
      normalMap: NormalMapConfig.create()
        .withZone({ regionId: "a", settings: "off" })
        .toJSON()
    });

    state.apply({
      action: "uv-region-deleted",
      metadata: { id: "a" }
    });

    assert.equal(state.uv.get("a"), undefined);
    assert.deepEqual(state.normalMap?.zones, []);
    assert.deepEqual(changes.at(-1), ["a"]);
  });

  test("a peer applying a document's commands, undo included, ends in the same state", () => {
    const events: PixelCommand[] = [];
    const doc = createDocument(events);
    const peer = new PixelDocumentState({
      buffer: new PixelBuffer({ size: { x: 4, y: 4 } })
    });
    const region = doc.uv.create({ width: 2, height: 2 });
    doc.uv.move(region.id, { x: 2, y: 2, width: 2, height: 2 });
    doc.paintPixels([{ x: 1, y: 1 }], { r: 1, g: 2, b: 3, a: 255 });
    doc.resize({ x: 3, y: 3 });
    doc.undo();
    doc.undo();
    doc.undo();

    for (const command of events) {
      peer.apply(toDocumentCommand(command));
    }

    assert.deepEqual(peer.buffer.pixels(), doc.buffer.pixels({ copy: false }));
    assert.deepEqual(
      [...peer.uv].map((each) => each.toJSON()),
      [...doc.uv].map((each) => each.toJSON())
    );
  });
});
