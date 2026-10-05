// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelDocument } from "#src/PixelDocument.ts";
import { ColorPalette } from "#src/palette/ColorPalette.ts";
import type { PixelCommand } from "#src/sync/PixelCommand.ts";

// CONSTANTS
const kColor = { r: 12, g: 34, b: 56, a: 128 };

describe("Pixel Document palette", () => {
  test("slot changes, undo and redo reach another document without echo", () => {
    const local = new PixelDocument({
      size: { x: 1, y: 1 },
      history: { enabled: true }
    });
    const peer = new PixelDocument({ size: { x: 1, y: 1 } });
    const echoed: PixelCommand[] = [];
    const before = local.palette.colorAt(3);
    peer.on("command", (command) => echoed.push(command));
    local.on("command", (command) => peer.applyRemoteCommand(command));

    local.changePaletteColor(3, kColor);
    assert.deepEqual(peer.palette.colorAt(3), kColor);
    local.undo();
    assert.deepEqual(peer.palette.colorAt(3), before);
    local.redo();
    assert.deepEqual(peer.palette.colorAt(3), kColor);
    assert.equal(echoed.length, 0);
    assert.equal(peer.history.canUndo, false);
  });

  test("unchanged colors and invalid edits create no history or commands", () => {
    const doc = new PixelDocument({
      size: { x: 1, y: 1 },
      history: { enabled: true }
    });
    const commands: PixelCommand[] = [];
    doc.on("command", (command) => commands.push(command));
    doc.changePaletteColor(0, doc.palette.colorAt(0));
    for (const index of [-1, 10, 0.5, NaN]) {
      assert.throws(() => doc.changePaletteColor(index, kColor), RangeError);
    }
    for (const r of [-1, 256, 0.5, NaN]) {
      assert.throws(() => doc.changePaletteColor(0, { ...kColor, r }), TypeError);
    }
    assert.equal(commands.length, 0);
    assert.equal(doc.history.canUndo, false);
  });

  test("snapshot replacement clears history and restores legacy defaults", () => {
    const doc = new PixelDocument({
      size: { x: 1, y: 1 },
      history: { enabled: true }
    });
    doc.changePaletteColor(0, kColor);
    const colors = ColorPalette.create().withColor(9, kColor).toJSON();
    doc.loadSnapshot({ x: 1, y: 1 }, new Uint8ClampedArray(4), [], null, colors);
    assert.deepEqual(doc.palette.colorAt(9), kColor);
    assert.equal(doc.history.canUndo, false);
    doc.loadSnapshot({ x: 1, y: 1 }, new Uint8ClampedArray(4));
    assert.deepEqual(doc.palette.toJSON(), ColorPalette.create().toJSON());
  });

  test("palette inputs and returned colors cannot mutate document state", () => {
    const doc = new PixelDocument({ size: { x: 1, y: 1 } });
    const color = { ...kColor };
    doc.changePaletteColor(2, color);
    color.r = 100;
    doc.palette.colorAt(2).g = 100;
    doc.palette.toJSON()[2].b = 100;
    assert.deepEqual(doc.palette.colorAt(2), kColor);
  });
});
