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
import {
  ColorPalette,
  NormalMapConfig,
  PixelDocument,
  type DocumentCommand,
  type RGBA8,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  pixelHistoryKeys,
  registerPixelHistory
} from "#src/history/pixelHistoryRegistration.ts";
import { HistoryDocument } from "../helpers/history/HistoryDocument.ts";

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

function strokeOf(
  positions: Vec2[],
  color: RGBA8
): DocumentCommand {
  return {
    action: "stroke",
    metadata: { color, positions }
  };
}

function localChange(
  command: DocumentCommand
): CommandChange<DocumentCommand, null> {
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
    const first = new CommandHistory<"build">();
    const second = new CommandHistory<"paint">();
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

describe("pixel history refusals", () => {
  test("a peer stroke over a pixel of a settled step refuses it, naming the peer", () => {
    const doc = createDocument();
    doc.paintPixels([{ x: 0, y: 0 }, { x: 1, y: 0 }], kRed);

    doc.applyRemoteCommand({
      action: "stroke",
      metadata: { color: kBlue, positions: [{ x: 1, y: 0 }] }
    }, "peer");

    assert.equal(doc.undo(), false);
    assert.deepEqual(doc.state.refused, [
      { label: "Paint", refused: { reason: "peer", clientId: "peer" } }
    ]);
  });

  test("a remote global fill refuses only the steps over the pixels it filled", () => {
    const doc = createDocument();
    doc.paintPixels([{ x: 0, y: 0 }], kRed);
    doc.paintPixels([{ x: 3, y: 3 }], kBlue);

    doc.applyRemoteCommand({
      action: "global-fill",
      metadata: { fromColor: kBlue, toColor: kRed }
    }, "peer");

    assert.equal(doc.state.undoCount, 1);
    assert.equal(doc.state.refused.length, 1);
  });

  test("a remote resize or texture replacement refuses the steps over pixels", () => {
    const resized = createDocument();
    resized.paintPixels([{ x: 0, y: 0 }], kRed);
    const replaced = createDocument();
    replaced.paintPixels([{ x: 0, y: 0 }], kRed);

    resized.applyRemoteCommand({
      action: "resized",
      metadata: { size: { x: 8, y: 2 } }
    });
    replaced.applyRemoteCommand({
      action: "texture-replaced",
      metadata: {
        size: { x: 1, y: 1 },
        pixels: Buffer.from([10, 20, 30, 255]).toString("base64")
      }
    });

    assert.deepEqual(
      [resized.canUndo, resized.state.refused.length],
      [false, 1]
    );
    assert.deepEqual(
      [replaced.canUndo, replaced.state.refused.length],
      [false, 1]
    );
  });

  test("a peer deleting a UV region refuses the steps that edited it", () => {
    const doc = createDocument();
    const region = doc.uv.create({ width: 2, height: 2 });
    doc.uv.move(region.id, { x: 1, y: 1, width: 2, height: 2 });

    doc.applyRemoteCommand({ action: "uv-region-deleted", metadata: { id: region.id } });

    assert.equal(doc.undo(), false);
    assert.deepEqual(doc.state.refused.map(({ refused }) => refused.reason), ["peer", "peer"]);
  });

  test("a snapshot load refuses the pixel, UV, normal map and palette steps it changed", () => {
    const doc = createDocument();
    doc.uv.create({ width: 2, height: 2 });
    doc.paintPixels([{ x: 0, y: 0 }], kRed);
    doc.enableNormalMap();
    doc.changePaletteColor(0, kBlue);

    doc.loadSnapshot(
      { x: 2, y: 1 },
      new Uint8ClampedArray(8),
      [],
      NormalMapConfig.create({ strength: 3 }).toJSON(),
      ColorPalette.create().withColor(9, kRed).toJSON()
    );

    assert.equal(doc.canUndo, false);
    assert.equal(doc.state.refused.length, 4);
  });
});
