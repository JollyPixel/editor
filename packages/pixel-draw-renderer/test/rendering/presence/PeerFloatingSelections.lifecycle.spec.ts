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
  makeFloatingSourceBuffer
} from "../../helpers/presence/floatingSelections.ts";

describe("PeerFloatingSelections — remove", () => {
  test("stops drawing the peer's ghost", () => {
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

    ghosts.remove("peer-A");

    const dest = makeCanvas(10);
    ghosts.draw(
      mockContextOf(dest).asRenderingContext()
    );
    assert.deepStrictEqual(
      readPixel(canvasPixels(dest), { x: 5, y: 5 }, 10),
      [0, 0, 0, 0]
    );
  });
});

describe("PeerFloatingSelections — isActive", () => {
  test("reflects whether any peer is tracked", () => {
    const buf = makeFloatingSourceBuffer();
    const ghosts = new PeerFloatingSelections(buf, FLOATING_ERASE_COLOR);
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
    const buf = makeFloatingSourceBuffer();
    const ghosts = new PeerFloatingSelections(buf, FLOATING_ERASE_COLOR);
    ghosts.set("peer-A", kState);

    ghosts.removeOverlapping([
      { x: 5, y: 5 }
    ]);

    assert.strictEqual(ghosts.isActive, false);
  });

  test("clears a ghost whose source rect overlaps the given positions", () => {
    const buf = makeFloatingSourceBuffer();
    const ghosts = new PeerFloatingSelections(buf, FLOATING_ERASE_COLOR);
    ghosts.set("peer-A", kState);

    ghosts.removeOverlapping([
      { x: 0, y: 0 }
    ]);

    assert.strictEqual(ghosts.isActive, false);
  });

  test("leaves a ghost untouched when neither footprint overlaps", () => {
    const buf = makeFloatingSourceBuffer();
    const ghosts = new PeerFloatingSelections(buf, FLOATING_ERASE_COLOR);
    ghosts.set("peer-A", kState);

    ghosts.removeOverlapping([
      { x: 100, y: 100 }
    ]);

    assert.strictEqual(ghosts.isActive, true);
  });
});

describe("PeerFloatingSelections — clearAll", () => {
  test("removes every peer's ghost", () => {
    const buf = makeFloatingSourceBuffer();
    const ghosts = new PeerFloatingSelections(buf, FLOATING_ERASE_COLOR);
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
    const buf = makeFloatingSourceBuffer();
    const ghosts = new PeerFloatingSelections(buf, FLOATING_ERASE_COLOR);
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
    const buf = makeFloatingSourceBuffer();
    const ghosts = new PeerFloatingSelections(buf, FLOATING_ERASE_COLOR);
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
