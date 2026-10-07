// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  CommandChange,
  CommandHistory
} from "@jolly-pixel/history";

// Import Internal Dependencies
import {
  pixelHistoryKeys,
  registerPixelHistory
} from "#src/history/pixelHistoryRegistration.ts";
import { PixelDocument } from "#src/PixelDocument.ts";
import {
  strokeOf,
  type DocumentCommand
} from "#src/sync/PixelCommand.ts";
import type { PixelChange } from "#src/sync/LocalEdit.types.ts";
import { HistoryDocument } from "../helpers/document/HistoryDocument.ts";

// CONSTANTS
const kRed = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};
const kBlue = {
  r: 0,
  g: 0,
  b: 255,
  a: 255
};

function localChange(
  command: DocumentCommand
): PixelChange {
  return CommandChange.local(command, null);
}

function createDocument(): HistoryDocument {
  return new HistoryDocument({
    size: {
      x: 4,
      y: 4
    }
  });
}

describe("pixelHistoryKeys", () => {
  test("a stroke guard holds what its pixels are now and notices a change", () => {
    const doc = createDocument();
    const guard = pixelHistoryKeys(doc).guard([strokeOf([{ x: 1, y: 1 }], kRed)]);
    const captured = guard.capture();

    assert.equal(guard.same(captured), true);
    doc.paintPixels([{ x: 2, y: 2 }], kBlue);
    assert.equal(guard.same(captured), true);
    doc.paintPixels([{ x: 1, y: 1 }], kBlue);
    assert.equal(guard.same(captured), false);
  });

  test("a resize or replacement touches every pixel guard, and no palette guard", () => {
    const doc = createDocument();
    const keys = pixelHistoryKeys(doc);
    const stroke = keys.guard([strokeOf([{ x: 1, y: 1 }], kRed)]);
    const palette = keys.guard([{
      action: "palette-color-changed",
      metadata: { index: 2, color: kRed }
    }]);
    const written = keys.written(CommandChange.remote(
      { action: "resized", metadata: { size: { x: 2, y: 2 } } },
      null,
      "peer"
    ));

    assert.equal(stroke.touches(written), true);
    assert.equal(palette.touches(written), false);
  });

  test("a texture guard covers every pixel and notices a resize", () => {
    const doc = createDocument();
    const keys = pixelHistoryKeys(doc);
    const guard = keys.guard([{
      action: "texture-replaced",
      metadata: { size: { x: 4, y: 4 }, pixels: doc.buffer.pixels() }
    }]);
    const captured = guard.capture();

    assert.equal(guard.touches(keys.written(localChange(strokeOf([{ x: 3, y: 3 }], kBlue)))), true);
    doc.resize({ x: 2, y: 2 });
    assert.equal(guard.same(captured), false);
  });

  test("a palette guard reads its slot", () => {
    const doc = createDocument();
    const keys = pixelHistoryKeys(doc);
    const guard = keys.guard([{
      action: "palette-color-changed",
      metadata: { index: 2, color: kRed }
    }]);
    const captured = guard.capture();

    assert.equal(guard.touches(keys.written(localChange({
      action: "palette-color-changed",
      metadata: { index: 2, color: kBlue }
    }))), true);
    doc.changePaletteColor(2, kBlue);
    assert.equal(guard.same(captured), false);
  });

  test("a UV guard reads only slots its region has", () => {
    const doc = createDocument();
    const region = doc.uv.create({ width: 2, height: 2 });
    const guard = pixelHistoryKeys(doc).guard([{
      action: "uv-region-deleted",
      metadata: { id: region.id }
    }]);

    assert.doesNotThrow(() => guard.capture());
  });
});

describe("registerPixelHistory", () => {
  test("every history a document is registered in files a batch as one step", () => {
    const doc = new PixelDocument({ size: { x: 4, y: 4 } });
    const first = new CommandHistory({ scopes: ["build"] });
    const second = new CommandHistory({ scopes: ["paint"] });
    const releaseFirst = registerPixelHistory(first, doc, { scope: "build" });
    registerPixelHistory(second, doc, { scope: "paint" });
    function paintTwice(): void {
      doc.batch(() => {
        doc.paintPixels([{ x: 0, y: 0 }], kRed);
        doc.paintPixels([{ x: 1, y: 0 }], kBlue);
      });
    }

    paintTwice();
    releaseFirst();
    paintTwice();

    assert.deepEqual(
      [first.state("build").undoCount, second.state("paint").undoCount],
      [1, 2]
    );
  });
});
