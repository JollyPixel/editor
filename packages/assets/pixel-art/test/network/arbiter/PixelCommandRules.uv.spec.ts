// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { KeyedCommandArbiter } from "@jolly-pixel/network";
import {
  PixelBuffer,
  PixelDocumentState,
  type SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PIXEL_COMMAND_RULES } from "#src/network/arbiter/PixelCommandRules.ts";
import type { PixelWireCommand } from "#src/network/protocol/types.ts";
import { command, freeRegion } from "../../fixtures/commands.ts";

// CONSTANTS
const kRect: SelectionRect = {
  x: 0,
  y: 0,
  width: 1,
  height: 1
};

function setup(): {
  arbiter: KeyedCommandArbiter<PixelWireCommand, PixelDocumentState>;
  state: PixelDocumentState;
} {
  return {
    arbiter: new KeyedCommandArbiter(PIXEL_COMMAND_RULES),
    state: new PixelDocumentState({
      buffer: new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: 8
      })
    })
  };
}

function accept(
  arbiter: KeyedCommandArbiter<PixelWireCommand, PixelDocumentState>,
  state: PixelDocumentState,
  pixelCommand: PixelWireCommand
): PixelWireCommand | null {
  const arbitration = arbiter.admit(state, pixelCommand);
  arbitration?.commit();

  return arbitration?.command ?? null;
}

describe("PixelCommandRules — uv regions", () => {
  test("rejects a stale move of a region moved by a newer command", () => {
    const { arbiter, state } = setup();
    accept(arbiter, state, command("uv-region-moved", { id: "r1", face: null, rect: kRect }, {
      clientId: "A",
      timestamp: 900
    }));

    const stale = command("uv-region-moved", { id: "r1", face: null, rect: kRect }, {
      clientId: "B",
      timestamp: 500
    });

    assert.strictEqual(accept(arbiter, state, stale), null);
  });

  test("rejects a stale delete of a region moved by a newer command", () => {
    const { arbiter, state } = setup();
    accept(arbiter, state, command("uv-region-moved", { id: "r1", face: null, rect: kRect }, {
      clientId: "A",
      timestamp: 900
    }));

    const stale = command("uv-region-deleted", { id: "r1" }, {
      clientId: "B",
      timestamp: 500
    });

    assert.strictEqual(accept(arbiter, state, stale), null);
  });

  test("rejects a stale move of a region deleted by a newer command", () => {
    const { arbiter, state } = setup();
    accept(arbiter, state, command("uv-region-deleted", { id: "r1" }, {
      clientId: "A",
      timestamp: 900
    }));

    const stale = command("uv-region-moved", { id: "r1", face: null, rect: kRect }, {
      clientId: "B",
      timestamp: 500
    });

    assert.strictEqual(accept(arbiter, state, stale), null);
  });

  test("rejects a delete older than a move of a derived slot", () => {
    const { arbiter, state } = setup();
    state.uv.restore({
      id: "block-1",
      color: "#fff",
      state: "free",
      faces: {
        top: kRect,
        "top.1": kRect
      }
    });
    accept(arbiter, state, command("uv-region-moved", { id: "block-1", face: "top.1", rect: kRect }, {
      clientId: "late",
      timestamp: 2000
    }));

    const stale = command("uv-region-deleted", { id: "block-1" }, {
      clientId: "early",
      timestamp: 1000
    });

    assert.strictEqual(accept(arbiter, state, stale), null);
  });

  test("commands on different regions never conflict", () => {
    const { arbiter, state } = setup();
    accept(arbiter, state, command("uv-region-moved", { id: "r1", face: null, rect: kRect }, {
      clientId: "A",
      timestamp: 900
    }));

    const older = command("uv-region-moved", { id: "r2", face: null, rect: kRect }, {
      clientId: "B",
      timestamp: 100
    });

    assert.deepStrictEqual(accept(arbiter, state, older), older);
  });

  test("moves of different faces of one region never conflict", () => {
    const { arbiter, state } = setup();
    accept(arbiter, state, command("uv-region-moved", { id: "r1", face: "top", rect: kRect }, {
      clientId: "A",
      timestamp: 900
    }));

    const older = command("uv-region-moved", { id: "r1", face: "bottom", rect: kRect }, {
      clientId: "B",
      timestamp: 500
    });

    assert.deepStrictEqual(accept(arbiter, state, older), older);
  });

  test("a state change claims every face, rejecting an older face move", () => {
    const { arbiter, state } = setup();
    accept(arbiter, state, command("uv-region-state-changed", { region: freeRegion("r1") }, {
      clientId: "A",
      timestamp: 900
    }));

    const stale = command("uv-region-moved", { id: "r1", face: "left", rect: kRect }, {
      clientId: "B",
      timestamp: 500
    });

    assert.strictEqual(accept(arbiter, state, stale), null);
  });

  test("rejects a region whose active face has no geometry", () => {
    const { arbiter, state } = setup();
    const region = {
      ...freeRegion("r1"),
      activeFaces: ["top", "top.1"]
    };

    assert.strictEqual(accept(arbiter, state, command("uv-region-created", { region })), null);
    assert.strictEqual(accept(arbiter, state, command("uv-region-state-changed", { region })), null);
  });

  test("rejects a compound part outside normalized space", () => {
    const { arbiter, state } = setup();
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

    assert.strictEqual(accept(arbiter, state, command("uv-region-created", { region })), null);
  });

  test("accepts a consistent region", () => {
    const { arbiter, state } = setup();
    const created = command("uv-region-created", { region: freeRegion("r1") });

    assert.deepStrictEqual(accept(arbiter, state, created), created);
  });
});

describe("PixelCommandRules — uv rotation", () => {
  test("a slot rotation only claims its own slot", () => {
    const { arbiter, state } = setup();
    accept(arbiter, state, command("uv-region-rotated", {
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

    assert.deepStrictEqual(accept(arbiter, state, otherFace), otherFace);
    assert.strictEqual(accept(arbiter, state, sameFace), null);
  });

  test("a region rotation claims every slot", () => {
    const { arbiter, state } = setup();
    accept(arbiter, state, command("uv-region-rotated", {
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

    assert.strictEqual(accept(arbiter, state, stale), null);
  });

  test("rejects an invalid rotation payload", () => {
    const { arbiter, state } = setup();

    assert.strictEqual(accept(arbiter, state, command("uv-region-rotated", {
      id: "r1",
      face: "top",
      geometry: { ...kRect, width: 0 }
    })), null);
    assert.strictEqual(accept(arbiter, state, command("uv-region-rotated", {
      id: "r2",
      face: null,
      region: freeRegion("r1")
    })), null);
  });
});
