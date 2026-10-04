// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PeerFloatingSelections,
  type PeerFloatingSelectionState
} from "#src/rendering/presence/PeerFloatingSelections.ts";
import {
  canvasPixels,
  mockContextOf,
  readPixel
} from "../../fixtures/canvas.ts";
import { makeCanvas } from "../../helpers/dom.ts";
import {
  FLOATING_ERASE_COLOR,
  FLOATING_SOURCE_BLUE,
  makeFloatingSourceBuffer
} from "../../helpers/presence/floatingSelections.ts";

describe("PeerFloatingSelections — set + draw", () => {
  test("blits the sampled source content at the live rect", () => {
    const buf = makeFloatingSourceBuffer();
    const ghosts = new PeerFloatingSelections(buf, FLOATING_ERASE_COLOR);
    const state: PeerFloatingSelectionState = {
      sourceRect: {
        x: 0,
        y: 0,
        width: 2,
        height: 1
      },
      liveRect: {
        x: 5,
        y: 5,
        width: 2,
        height: 1
      },
      mask: [true, true],
      blankSource: false
    };

    ghosts.set("peer-A", state);

    const dest = makeCanvas(10);
    ghosts.draw(mockContextOf(dest).asRenderingContext());

    assert.deepStrictEqual(
      readPixel(canvasPixels(dest), { x: 5, y: 5 }, 10),
      [255, 0, 0, 255]
    );
    assert.deepStrictEqual(
      readPixel(canvasPixels(dest), { x: 6, y: 5 }, 10),
      [0, 0, 255, 255]
    );
  });

  test("blankSource: false leaves the source rect untouched", () => {
    const buf = makeFloatingSourceBuffer();
    const ghosts = new PeerFloatingSelections(buf, FLOATING_ERASE_COLOR);
    const state: PeerFloatingSelectionState = {
      sourceRect: {
        x: 0,
        y: 0,
        width: 1,
        height: 1
      },
      liveRect: {
        x: 5,
        y: 5,
        width: 1,
        height: 1
      },
      mask: [true],
      blankSource: false
    };

    ghosts.set("peer-A", state);

    const dest = makeCanvas(10);
    ghosts.draw(
      mockContextOf(dest).asRenderingContext()
    );

    assert.deepStrictEqual(
      readPixel(canvasPixels(dest), { x: 0, y: 0 }, 10),
      [0, 0, 0, 0]
    );
  });

  test("blankSource: true erases only masked-true source cells and masked-false cells are not drawn", () => {
    const buf = makeFloatingSourceBuffer();
    const ghosts = new PeerFloatingSelections(buf, FLOATING_ERASE_COLOR);
    const state: PeerFloatingSelectionState = {
      sourceRect: {
        x: 0,
        y: 0,
        width: 2,
        height: 1
      },
      liveRect: {
        x: 5,
        y: 5,
        width: 2,
        height: 1
      },
      mask: [true, false],
      blankSource: true
    };

    ghosts.set("peer-A", state);

    const dest = makeCanvas(10);
    const destCtx = mockContextOf(dest);
    destCtx.fillStyle = "#00ff00";
    destCtx.fillRect(0, 0, 10, 10);
    ghosts.draw(destCtx.asRenderingContext());

    assert.deepStrictEqual(
      readPixel(canvasPixels(dest), { x: 0, y: 0 }, 10),
      [9, 9, 9, 255],
      "masked-true source blanked"
    );
    assert.deepStrictEqual(
      readPixel(canvasPixels(dest), { x: 1, y: 0 }, 10),
      [0, 255, 0, 255],
      "masked-false source left alone"
    );
    assert.deepStrictEqual(
      readPixel(canvasPixels(dest), { x: 6, y: 5 }, 10),
      [0, 255, 0, 255],
      "masked-false cell not drawn at destination"
    );
  });

  test("a later tick with the same sourceRect repositions without resampling the buffer", () => {
    const buf = makeFloatingSourceBuffer();
    const ghosts = new PeerFloatingSelections(buf, FLOATING_ERASE_COLOR);
    const sourceRect = {
      x: 0,
      y: 0,
      width: 1,
      height: 1
    };

    ghosts.set(
      "peer-A",
      {
        sourceRect,
        liveRect: {
          x: 5,
          y: 5,
          width: 1,
          height: 1
        },
        mask: [true],
        blankSource: false
      }
    );
    buf.drawPixels([{ x: 0, y: 0 }], FLOATING_SOURCE_BLUE);
    ghosts.set(
      "peer-A",
      {
        sourceRect,
        liveRect: {
          x: 6,
          y: 6,
          width: 1,
          height: 1
        },
        mask: [true],
        blankSource: false
      }
    );

    const dest = makeCanvas(10);
    ghosts.draw(mockContextOf(dest).asRenderingContext());

    assert.deepStrictEqual(
      readPixel(canvasPixels(dest), { x: 6, y: 6 }, 10),
      [255, 0, 0, 255],
      "still the originally sampled red"
    );
    assert.deepStrictEqual(
      readPixel(canvasPixels(dest), { x: 5, y: 5 }, 10),
      [0, 0, 0, 0],
      "old live position no longer drawn"
    );
  });

  test("a different sourceRect (new gesture) resamples the buffer", () => {
    const buf = makeFloatingSourceBuffer();
    const ghosts = new PeerFloatingSelections(buf, FLOATING_ERASE_COLOR);

    ghosts.set(
      "peer-A",
      {
        sourceRect: {
          x: 0,
          y: 0,
          width: 1,
          height: 1
        },
        liveRect: {
          x: 5,
          y: 5,
          width: 1,
          height: 1
        },
        mask: [true],
        blankSource: false
      }
    );
    ghosts.set(
      "peer-A",
      {
        sourceRect: {
          x: 1,
          y: 0,
          width: 1,
          height: 1
        },
        liveRect: {
          x: 5,
          y: 5,
          width: 1,
          height: 1
        },
        mask: [true],
        blankSource: false
      }
    );

    const dest = makeCanvas(10);
    ghosts.draw(
      mockContextOf(dest).asRenderingContext()
    );

    assert.deepStrictEqual(
      readPixel(canvasPixels(dest), { x: 5, y: 5 }, 10),
      [0, 0, 255, 255],
      "resampled the blue pixel at the new sourceRect"
    );
  });
});
