// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { KeyedCommandArbiter } from "@jolly-pixel/network";
import { PixelBuffer, PixelDocumentState } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PIXEL_COMMAND_RULES } from "#src/network/arbiter/PixelCommandRules.ts";
import type { PixelWireCommand } from "#src/network/protocol/types.ts";
import { packColors } from "#src/network/protocol/PixelWireCodec.ts";
import {
  command,
  gray,
  packed
} from "../../fixtures/commands.ts";

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

describe("PixelCommandRules — pixels", () => {
  test("accepts an uncontested stroke unchanged", () => {
    const { arbiter, state } = setup();
    const stroke = command("stroke", {
      color: gray(1),
      positions: [{ x: 1, y: 1 }]
    });

    assert.strictEqual(accept(arbiter, state, stroke), stroke);
  });

  test("accepts a newer stroke from another client at the same pixel", () => {
    const { arbiter, state } = setup();
    const positions = [{ x: 0, y: 0 }];
    accept(arbiter, state, command("stroke", { color: gray(1), positions }, {
      clientId: "A",
      timestamp: 500
    }));
    const newer = command("stroke", { color: gray(2), positions }, {
      clientId: "B",
      timestamp: 900
    });

    assert.deepStrictEqual(accept(arbiter, state, newer), newer);
  });

  test("accepts an uncontested packed stroke unchanged", () => {
    const { arbiter, state } = setup();
    const stroke = packed(command("stroke", {
      color: gray(1),
      positions: [{ x: 1, y: 1 }]
    }));

    assert.strictEqual(accept(arbiter, state, stroke), stroke);
  });

  test("narrows a stroke to the positions that won, packed", () => {
    const { arbiter, state } = setup();
    accept(arbiter, state, command("stroke", {
      color: gray(9),
      positions: [{ x: 0, y: 0 }]
    }, { clientId: "late", timestamp: 2000 }));

    const accepted = accept(arbiter, state, command("stroke", {
      color: gray(1),
      positions: [{ x: 0, y: 0 }, { x: 1, y: 1 }]
    }, { clientId: "early", timestamp: 1000 }));

    assert.deepStrictEqual(accepted, packed(command("stroke", {
      color: gray(1),
      positions: [{ x: 1, y: 1 }]
    }, { clientId: "early", timestamp: 1000 })));
  });

  test("rejects a stroke when every position lost", () => {
    const { arbiter, state } = setup();
    const positions = [{ x: 0, y: 0 }];
    accept(arbiter, state, command("stroke", { color: gray(1), positions }, {
      clientId: "late",
      timestamp: 2000
    }));

    const stale = command("stroke", { color: gray(2), positions }, {
      clientId: "early",
      timestamp: 1000
    });

    assert.strictEqual(accept(arbiter, state, stale), null);
  });

  test("accepts an older undo replay from the client that wrote the pixel", () => {
    const { arbiter, state } = setup();
    const positions = [{ x: 0, y: 0 }];
    for (const timestamp of [100, 200, 200]) {
      accept(arbiter, state, command("stroke", { color: gray(1), positions }, {
        clientId: "A",
        timestamp
      }));
    }

    const replay = command("stroke", { color: gray(0), positions }, {
      clientId: "A",
      timestamp: 100
    });

    assert.deepStrictEqual(accept(arbiter, state, replay), replay);
  });

  test("narrows a select-edit's positions and colors together, packed", () => {
    const { arbiter, state } = setup();
    accept(arbiter, state, command("stroke", {
      color: gray(9),
      positions: [{ x: 0, y: 0 }]
    }, { clientId: "A", timestamp: 900 }));

    const accepted = accept(arbiter, state, command("select-edit", {
      positions: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      colors: [gray(1), gray(2)]
    }, { clientId: "B", timestamp: 500 }));

    assert.deepStrictEqual(accepted?.metadata, {
      xy: [1, 1],
      rgba: packColors([gray(2)])
    });
  });

  test("rejects a select-edit when every position lost", () => {
    const { arbiter, state } = setup();
    accept(arbiter, state, command("stroke", {
      color: gray(9),
      positions: [{ x: 0, y: 0 }]
    }, { clientId: "A", timestamp: 900 }));

    const stale = command("select-edit", {
      positions: [{ x: 0, y: 0 }],
      colors: [gray(1)]
    }, { clientId: "B", timestamp: 500 });

    assert.strictEqual(accept(arbiter, state, stale), null);
  });

  test("rejects a select-edit whose colors do not match its positions", () => {
    const { arbiter, state } = setup();

    assert.strictEqual(accept(arbiter, state, command("select-edit", {
      positions: [{ x: 0, y: 0 }],
      colors: []
    })), null);
  });

  test("rejects a packed select-edit whose colors do not match its positions", () => {
    const { arbiter, state } = setup();
    const mismatched: PixelWireCommand = {
      clientId: "client-A",
      seq: 1,
      timestamp: 1000,
      action: "select-edit",
      metadata: {
        xy: [0, 0, 1, 0],
        rgba: packColors([gray(1)])
      }
    };

    assert.strictEqual(accept(arbiter, state, mismatched), null);
  });

  test("leaves the state untouched", () => {
    const { arbiter, state } = setup();
    const before = Uint8ClampedArray.from(state.buffer.pixels());

    accept(arbiter, state, command("stroke", {
      color: gray(1),
      positions: [{ x: 0, y: 0 }]
    }));

    assert.deepStrictEqual(state.buffer.pixels(), before);
  });

  test("rejects a size the state would refuse", () => {
    const { arbiter, state } = setup();

    assert.strictEqual(accept(arbiter, state, command("resized", { size: { x: 99, y: 4 } })), null);
    assert.strictEqual(accept(arbiter, state, command("resized", { size: { x: 0, y: 4 } })), null);
    assert.notStrictEqual(accept(arbiter, state, command("resized", { size: { x: 8, y: 8 } })), null);
  });

  test("a replacement supersedes every pixel, rejecting older strokes from others", () => {
    const { arbiter, state } = setup();
    accept(arbiter, state, command("stroke", {
      color: gray(1),
      positions: [{ x: 0, y: 0 }]
    }, { clientId: "A", timestamp: 100 }));
    accept(arbiter, state, command("texture-replaced", {
      size: { x: 4, y: 4 },
      pixels: ""
    }, { clientId: "B", timestamp: 500 }));

    const older = command("stroke", {
      color: gray(2),
      positions: [{ x: 3, y: 3 }]
    }, { clientId: "C", timestamp: 400 });
    const newer = command("stroke", {
      color: gray(2),
      positions: [{ x: 3, y: 3 }]
    }, { clientId: "C", timestamp: 600 });

    assert.strictEqual(accept(arbiter, state, older), null);
    assert.strictEqual(accept(arbiter, state, newer), newer);
  });
});
