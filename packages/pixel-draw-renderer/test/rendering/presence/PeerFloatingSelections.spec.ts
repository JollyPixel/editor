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
import { CanvasBuffer } from "#src/buffer/CanvasBuffer.ts";
import {
  canvasPixels,
  mockContextOf,
  readPixel
} from "../../fixtures/canvas.ts";
import type { RGBA } from "#src/types.ts";

// CONSTANTS
const kTestMaxSize = 32;
const kRed: RGBA = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};
const kBlue: RGBA = {
  r: 0,
  g: 0,
  b: 255,
  a: 255
};
const kErase: RGBA = {
  r: 9,
  g: 9,
  b: 9,
  a: 255
};

function makeBuffer(): CanvasBuffer {
  const buf = new CanvasBuffer({
    size: { x: 8, y: 8 },
    maxSize: kTestMaxSize
  });
  buf.drawPixels([{ x: 0, y: 0 }], kRed);
  buf.drawPixels([{ x: 1, y: 0 }], kBlue);

  return buf;
}

function makeDest(): HTMLCanvasElement {
  const dest = document.createElement("canvas");
  dest.width = 10;
  dest.height = 10;

  return dest;
}

describe("PeerFloatingSelections — set + draw", () => {
  test("blits the sampled source content at the live rect", () => {
    const buf = makeBuffer();
    const ghosts = new PeerFloatingSelections(buf, kErase);
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

    const dest = makeDest();
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

  test("blankSource: true paints the erase color over the source rect", () => {
    const buf = makeBuffer();
    const ghosts = new PeerFloatingSelections(buf, kErase);
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
      blankSource: true
    };

    ghosts.set("peer-A", state);

    const dest = makeDest();
    ghosts.draw(mockContextOf(dest).asRenderingContext());

    assert.deepStrictEqual(
      readPixel(canvasPixels(dest), { x: 0, y: 0 }, 10),
      [9, 9, 9, 255]
    );
  });

  test("blankSource: false leaves the source rect untouched", () => {
    const buf = makeBuffer();
    const ghosts = new PeerFloatingSelections(buf, kErase);
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

    const dest = makeDest();
    ghosts.draw(
      mockContextOf(dest).asRenderingContext()
    );

    assert.deepStrictEqual(
      readPixel(canvasPixels(dest), { x: 0, y: 0 }, 10),
      [0, 0, 0, 0]
    );
  });

  test("masked-false cells are neither blanked at the source nor drawn at the destination", () => {
    const buf = makeBuffer();
    const ghosts = new PeerFloatingSelections(buf, kErase);
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

    const dest = makeDest();
    ghosts.draw(
      mockContextOf(dest).asRenderingContext()
    );

    assert.deepStrictEqual(
      readPixel(canvasPixels(dest), { x: 0, y: 0 }, 10),
      [9, 9, 9, 255],
      "masked-true source blanked"
    );
    assert.deepStrictEqual(
      readPixel(canvasPixels(dest), { x: 1, y: 0 }, 10),
      [0, 0, 0, 0],
      "masked-false source left alone"
    );
    assert.deepStrictEqual(
      readPixel(canvasPixels(dest), { x: 6, y: 5 }, 10),
      [0, 0, 0, 0],
      "masked-false cell not drawn at destination"
    );
  });

  test("draw is a no-op when nothing has been set", () => {
    const buf = makeBuffer();
    const ghosts = new PeerFloatingSelections(buf, kErase);
    const dest = makeDest();

    assert.doesNotThrow(() => ghosts.draw(mockContextOf(dest).asRenderingContext()));
  });

  test("a later tick with the same sourceRect repositions without resampling the buffer", () => {
    const buf = makeBuffer();
    const ghosts = new PeerFloatingSelections(buf, kErase);
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
    // The buffer changes after the gesture started; the cached snapshot should
    // still reflect the original red pixel, not this new one.
    buf.drawPixels([{ x: 0, y: 0 }], kBlue);
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

    const dest = makeDest();
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
    const buf = makeBuffer();
    const ghosts = new PeerFloatingSelections(buf, kErase);

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

    const dest = makeDest();
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

describe("PeerFloatingSelections — remove", () => {
  test("stops drawing the peer's ghost", () => {
    const buf = makeBuffer();
    const ghosts = new PeerFloatingSelections(buf, kErase);
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

    ghosts.remove("peer-A");

    const dest = makeDest();
    ghosts.draw(
      mockContextOf(dest).asRenderingContext()
    );
    assert.deepStrictEqual(
      readPixel(canvasPixels(dest), { x: 5, y: 5 }, 10),
      [0, 0, 0, 0]
    );
  });

  test("removing an unknown peer is a no-op", () => {
    const buf = makeBuffer();
    const ghosts = new PeerFloatingSelections(buf, kErase);

    assert.doesNotThrow(
      () => ghosts.remove("nobody")
    );
  });
});

describe("PeerFloatingSelections — isActive", () => {
  test("reflects whether any peer is tracked", () => {
    const buf = makeBuffer();
    const ghosts = new PeerFloatingSelections(buf, kErase);
    assert.strictEqual(ghosts.isActive, false);

    ghosts.set("peer-A", {
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
    });
    assert.strictEqual(ghosts.isActive, true);

    ghosts.remove("peer-A");
    assert.strictEqual(ghosts.isActive, false);
  });
});

describe("PeerFloatingSelections — removeOverlapping", () => {
  const kState: PeerFloatingSelectionState = {
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

  test("clears a ghost whose live rect overlaps the given positions", () => {
    const buf = makeBuffer();
    const ghosts = new PeerFloatingSelections(buf, kErase);
    ghosts.set("peer-A", kState);

    ghosts.removeOverlapping([
      { x: 5, y: 5 }
    ]);

    assert.strictEqual(ghosts.isActive, false);
  });

  test("clears a ghost whose source rect overlaps the given positions", () => {
    const buf = makeBuffer();
    const ghosts = new PeerFloatingSelections(buf, kErase);
    ghosts.set("peer-A", kState);

    ghosts.removeOverlapping([
      { x: 0, y: 0 }
    ]);

    assert.strictEqual(ghosts.isActive, false);
  });

  test("leaves a ghost untouched when neither footprint overlaps", () => {
    const buf = makeBuffer();
    const ghosts = new PeerFloatingSelections(buf, kErase);
    ghosts.set("peer-A", kState);

    ghosts.removeOverlapping([
      { x: 100, y: 100 }
    ]);

    assert.strictEqual(ghosts.isActive, true);
  });

  test("is a no-op for an empty positions array", () => {
    const buf = makeBuffer();
    const ghosts = new PeerFloatingSelections(buf, kErase);
    ghosts.set("peer-A", kState);

    ghosts.removeOverlapping([]);

    assert.ok(ghosts.isActive);
  });
});

describe("PeerFloatingSelections — clearAll", () => {
  test("removes every peer's ghost", () => {
    const buf = makeBuffer();
    const ghosts = new PeerFloatingSelections(buf, kErase);
    ghosts.set("peer-A", {
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
    });
    ghosts.set("peer-B", {
      sourceRect: {
        x: 1,
        y: 0,
        width: 1,
        height: 1
      },
      liveRect: {
        x: 6,
        y: 6,
        width: 1,
        height: 1
      },
      mask: [true],
      blankSource: false
    });

    ghosts.clearAll();

    assert.strictEqual(ghosts.isActive, false);
  });
});

describe("PeerFloatingSelections — changed signal", () => {
  test("emits on set and on a remove that actually clears something", () => {
    const buf = makeBuffer();
    const ghosts = new PeerFloatingSelections(buf, kErase);
    let changes = 0;
    ghosts.on("changed", () => {
      changes++;
    });

    ghosts.set("peer-A", {
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
    });
    assert.strictEqual(changes, 1);

    ghosts.remove("peer-A");
    assert.strictEqual(changes, 2);

    ghosts.remove("peer-A");
    assert.strictEqual(changes, 2, "removing an already-absent peer does not emit again");
  });
});

describe("PeerFloatingSelections — destroy", () => {
  test("clears every tracked peer", () => {
    const buf = makeBuffer();
    const ghosts = new PeerFloatingSelections(buf, kErase);
    ghosts.set("peer-A", {
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
    });

    ghosts.destroy();

    assert.strictEqual(ghosts.isActive, false);
  });
});
