// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  PixelBuffer,
  type SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PixelCommandArbiter } from "#src/network/PixelCommandArbiter.ts";
import type { PixelNetworkCommand } from "#src/network/types.ts";
import {
  command,
  freeRegion,
  gray
} from "../fixtures/commands.ts";

// CONSTANTS
const kRect: SelectionRect = {
  x: 0,
  y: 0,
  width: 1,
  height: 1
};

function setup(): {
  arbiter: PixelCommandArbiter;
  buffer: PixelBuffer;
} {
  return {
    arbiter: new PixelCommandArbiter(),
    buffer: new PixelBuffer({
      size: { x: 4, y: 4 },
      maxSize: 8
    })
  };
}

function accept(
  arbiter: PixelCommandArbiter,
  buffer: PixelBuffer,
  pixelCommand: PixelNetworkCommand
): PixelNetworkCommand | null {
  const arbitration = arbiter.admit(buffer, pixelCommand);
  arbitration?.commit();

  return arbitration?.command ?? null;
}

describe("PixelCommandArbiter — pixels", () => {
  test("accepts an uncontested stroke unchanged", () => {
    const { arbiter, buffer } = setup();
    const stroke = command("stroke", {
      color: gray(1),
      positions: [{ x: 1, y: 1 }]
    });

    assert.deepStrictEqual(accept(arbiter, buffer, stroke), stroke);
  });

  test("accepts a newer stroke from another client at the same pixel", () => {
    const { arbiter, buffer } = setup();
    const positions = [{ x: 0, y: 0 }];
    accept(arbiter, buffer, command("stroke", { color: gray(1), positions }, {
      clientId: "A",
      timestamp: 500
    }));
    const newer = command("stroke", { color: gray(2), positions }, {
      clientId: "B",
      timestamp: 900
    });

    assert.deepStrictEqual(accept(arbiter, buffer, newer), newer);
  });

  test("narrows a stroke to the positions that won", () => {
    const { arbiter, buffer } = setup();
    accept(arbiter, buffer, command("stroke", {
      color: gray(9),
      positions: [{ x: 0, y: 0 }]
    }, { clientId: "late", timestamp: 2000 }));

    const accepted = accept(arbiter, buffer, command("stroke", {
      color: gray(1),
      positions: [{ x: 0, y: 0 }, { x: 1, y: 1 }]
    }, { clientId: "early", timestamp: 1000 }));

    assert.deepStrictEqual(accepted, command("stroke", {
      color: gray(1),
      positions: [{ x: 1, y: 1 }]
    }, { clientId: "early", timestamp: 1000 }));
  });

  test("rejects a stroke when every position lost", () => {
    const { arbiter, buffer } = setup();
    const positions = [{ x: 0, y: 0 }];
    accept(arbiter, buffer, command("stroke", { color: gray(1), positions }, {
      clientId: "late",
      timestamp: 2000
    }));

    const stale = command("stroke", { color: gray(2), positions }, {
      clientId: "early",
      timestamp: 1000
    });

    assert.strictEqual(accept(arbiter, buffer, stale), null);
  });

  test("accepts an older undo replay from the client that wrote the pixel", () => {
    const { arbiter, buffer } = setup();
    const positions = [{ x: 0, y: 0 }];
    for (const timestamp of [100, 200, 200]) {
      accept(arbiter, buffer, command("stroke", { color: gray(1), positions }, {
        clientId: "A",
        timestamp
      }));
    }

    const replay = command("stroke", { color: gray(0), positions }, {
      clientId: "A",
      timestamp: 100
    });

    assert.deepStrictEqual(accept(arbiter, buffer, replay), replay);
  });

  test("narrows a select-edit's positions and colors together", () => {
    const { arbiter, buffer } = setup();
    accept(arbiter, buffer, command("stroke", {
      color: gray(9),
      positions: [{ x: 0, y: 0 }]
    }, { clientId: "A", timestamp: 900 }));

    const accepted = accept(arbiter, buffer, command("select-edit", {
      positions: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      colors: [gray(1), gray(2)]
    }, { clientId: "B", timestamp: 500 }));

    assert.deepStrictEqual(accepted?.metadata, {
      positions: [{ x: 1, y: 1 }],
      colors: [gray(2)]
    });
  });

  test("rejects a select-edit when every position lost", () => {
    const { arbiter, buffer } = setup();
    accept(arbiter, buffer, command("stroke", {
      color: gray(9),
      positions: [{ x: 0, y: 0 }]
    }, { clientId: "A", timestamp: 900 }));

    const stale = command("select-edit", {
      positions: [{ x: 0, y: 0 }],
      colors: [gray(1)]
    }, { clientId: "B", timestamp: 500 });

    assert.strictEqual(accept(arbiter, buffer, stale), null);
  });

  test("rejects a select-edit whose colors do not match its positions", () => {
    const { arbiter, buffer } = setup();

    assert.strictEqual(accept(arbiter, buffer, command("select-edit", {
      positions: [{ x: 0, y: 0 }],
      colors: []
    })), null);
  });

  test("leaves the buffer untouched", () => {
    const { arbiter, buffer } = setup();
    const before = Uint8ClampedArray.from(buffer.pixels());

    accept(arbiter, buffer, command("stroke", {
      color: gray(1),
      positions: [{ x: 0, y: 0 }]
    }));

    assert.deepStrictEqual(buffer.pixels(), before);
  });

  test("rejects a size the buffer would refuse", () => {
    const { arbiter, buffer } = setup();

    assert.strictEqual(accept(arbiter, buffer, command("resized", { size: { x: 99, y: 4 } })), null);
    assert.strictEqual(accept(arbiter, buffer, command("resized", { size: { x: 0, y: 4 } })), null);
    assert.notStrictEqual(accept(arbiter, buffer, command("resized", { size: { x: 8, y: 8 } })), null);
  });
});

describe("PixelCommandArbiter — uv regions", () => {
  test("rejects a stale move of a region moved by a newer command", () => {
    const { arbiter, buffer } = setup();
    accept(arbiter, buffer, command("uv-region-moved", { id: "r1", face: null, rect: kRect }, {
      clientId: "A",
      timestamp: 900
    }));

    const stale = command("uv-region-moved", { id: "r1", face: null, rect: kRect }, {
      clientId: "B",
      timestamp: 500
    });

    assert.strictEqual(accept(arbiter, buffer, stale), null);
  });

  test("rejects a stale delete of a region moved by a newer command", () => {
    const { arbiter, buffer } = setup();
    accept(arbiter, buffer, command("uv-region-moved", { id: "r1", face: null, rect: kRect }, {
      clientId: "A",
      timestamp: 900
    }));

    const stale = command("uv-region-deleted", { id: "r1" }, {
      clientId: "B",
      timestamp: 500
    });

    assert.strictEqual(accept(arbiter, buffer, stale), null);
  });

  test("rejects a stale move of a region deleted by a newer command", () => {
    const { arbiter, buffer } = setup();
    accept(arbiter, buffer, command("uv-region-deleted", { id: "r1" }, {
      clientId: "A",
      timestamp: 900
    }));

    const stale = command("uv-region-moved", { id: "r1", face: null, rect: kRect }, {
      clientId: "B",
      timestamp: 500
    });

    assert.strictEqual(accept(arbiter, buffer, stale), null);
  });

  test("rejects a delete older than a move of a derived slot", () => {
    const { arbiter, buffer } = setup();
    buffer.uvRegions.set({
      id: "block-1",
      color: "#fff",
      state: "free",
      faces: {
        top: kRect,
        "top.1": kRect
      }
    });
    accept(arbiter, buffer, command("uv-region-moved", { id: "block-1", face: "top.1", rect: kRect }, {
      clientId: "late",
      timestamp: 2000
    }));

    const stale = command("uv-region-deleted", { id: "block-1" }, {
      clientId: "early",
      timestamp: 1000
    });

    assert.strictEqual(accept(arbiter, buffer, stale), null);
  });

  test("commands on different regions never conflict", () => {
    const { arbiter, buffer } = setup();
    accept(arbiter, buffer, command("uv-region-moved", { id: "r1", face: null, rect: kRect }, {
      clientId: "A",
      timestamp: 900
    }));

    const older = command("uv-region-moved", { id: "r2", face: null, rect: kRect }, {
      clientId: "B",
      timestamp: 100
    });

    assert.deepStrictEqual(accept(arbiter, buffer, older), older);
  });

  test("moves of different faces of one region never conflict", () => {
    const { arbiter, buffer } = setup();
    accept(arbiter, buffer, command("uv-region-moved", { id: "r1", face: "top", rect: kRect }, {
      clientId: "A",
      timestamp: 900
    }));

    const older = command("uv-region-moved", { id: "r1", face: "bottom", rect: kRect }, {
      clientId: "B",
      timestamp: 500
    });

    assert.deepStrictEqual(accept(arbiter, buffer, older), older);
  });

  test("a state change claims every face, rejecting an older face move", () => {
    const { arbiter, buffer } = setup();
    accept(arbiter, buffer, command("uv-region-state-changed", { region: freeRegion("r1") }, {
      clientId: "A",
      timestamp: 900
    }));

    const stale = command("uv-region-moved", { id: "r1", face: "left", rect: kRect }, {
      clientId: "B",
      timestamp: 500
    });

    assert.strictEqual(accept(arbiter, buffer, stale), null);
  });

  test("rejects a region whose active face has no geometry", () => {
    const { arbiter, buffer } = setup();
    const region = {
      ...freeRegion("r1"),
      activeFaces: ["top", "top.1"]
    };

    assert.strictEqual(accept(arbiter, buffer, command("uv-region-created", { region })), null);
    assert.strictEqual(accept(arbiter, buffer, command("uv-region-state-changed", { region })), null);
  });

  test("rejects a compound part outside normalized space", () => {
    const { arbiter, buffer } = setup();
    const region = {
      id: "r1",
      color: "#f00",
      state: "free" as const,
      faces: {
        right: {
          shape: "compound" as const,
          rect: kRect,
          parts: [{ x: 0.75, y: 0, width: 0.5, height: 1 }]
        }
      }
    };

    assert.strictEqual(accept(arbiter, buffer, command("uv-region-created", { region })), null);
  });

  test("accepts a consistent region", () => {
    const { arbiter, buffer } = setup();
    const created = command("uv-region-created", { region: freeRegion("r1") });

    assert.deepStrictEqual(accept(arbiter, buffer, created), created);
  });
});

describe("PixelCommandArbiter — uv rotation", () => {
  test("a slot rotation only claims its own slot", () => {
    const { arbiter, buffer } = setup();
    accept(arbiter, buffer, command("uv-region-rotated", {
      id: "r1",
      face: "top",
      geometry: { ...kRect, rotation: 1 }
    }, {
      clientId: "A",
      timestamp: 900
    }));

    const otherFace = command("uv-region-moved", { id: "r1", face: "left", rect: kRect }, {
      clientId: "B",
      timestamp: 500
    });
    const sameFace = command("uv-region-moved", { id: "r1", face: "top", rect: kRect }, {
      clientId: "B",
      timestamp: 500
    });

    assert.deepStrictEqual(accept(arbiter, buffer, otherFace), otherFace);
    assert.strictEqual(accept(arbiter, buffer, sameFace), null);
  });

  test("a region rotation claims every slot", () => {
    const { arbiter, buffer } = setup();
    accept(arbiter, buffer, command("uv-region-rotated", {
      id: "r1",
      face: null,
      region: freeRegion("r1")
    }, {
      clientId: "A",
      timestamp: 900
    }));

    const stale = command("uv-region-moved", { id: "r1", face: "left", rect: kRect }, {
      clientId: "B",
      timestamp: 500
    });

    assert.strictEqual(accept(arbiter, buffer, stale), null);
  });

  test("rejects an invalid rotation payload", () => {
    const { arbiter, buffer } = setup();

    assert.strictEqual(accept(arbiter, buffer, command("uv-region-rotated", {
      id: "r1",
      face: "top",
      geometry: { ...kRect, width: 0 }
    })), null);
    assert.strictEqual(accept(arbiter, buffer, command("uv-region-rotated", {
      id: "r2",
      face: null,
      region: freeRegion("r1")
    })), null);
  });
});
