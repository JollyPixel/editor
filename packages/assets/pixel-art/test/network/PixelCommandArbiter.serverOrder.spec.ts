// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { PixelBuffer, PixelDocumentState } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PixelCommandArbiter } from "#src/network/PixelCommandArbiter.ts";
import {
  command,
  gray,
  packed
} from "../fixtures/commands.ts";

function setup(): {
  arbiter: PixelCommandArbiter;
  state: PixelDocumentState;
} {
  return {
    arbiter: new PixelCommandArbiter(),
    state: new PixelDocumentState({
      buffer: new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: 8
      })
    })
  };
}

describe("PixelCommandArbiter — server order", () => {
  test("a global fill claims the pixels it repaints", () => {
    const { arbiter, state } = setup();
    const [r, g, b, a] = state.buffer.samplePixel(3, 3);
    const fill = arbiter.admit(
      state,
      command("global-fill", { fromColor: { r, g, b, a }, toColor: gray(9) }, { clientId: "B" })
    );
    fill?.commit(5);

    const undo = packed(command("stroke", {
      color: gray(1),
      positions: [{ x: 3, y: 3 }]
    }, { clientId: "A", basis: 4 }));

    assert.strictEqual(arbiter.admit(state, undo), null);
  });

  test("restore records a past stroke so an older replay loses to it", () => {
    const { arbiter, state } = setup();
    arbiter.restore(packed(command("stroke", {
      color: gray(2),
      positions: [{ x: 0, y: 0 }]
    }, { clientId: "B" })), 7);

    const replay = packed(command("stroke", {
      color: gray(1),
      positions: [{ x: 0, y: 0 }]
    }, { clientId: "A", basis: 6 }));
    const fresh = packed(command("stroke", {
      color: gray(1),
      positions: [{ x: 0, y: 0 }]
    }, { clientId: "A", timestamp: 1 }));

    assert.strictEqual(arbiter.admit(state, replay), null);
    assert.notStrictEqual(arbiter.admit(state, fresh), null);
  });

  test("restore of a replacement rejects replays older than it", () => {
    const { arbiter, state } = setup();
    arbiter.restore(command("resized", { size: { x: 4, y: 4 } }, { clientId: "B" }), 3);

    assert.strictEqual(arbiter.admit(state, packed(command("stroke", {
      color: gray(1),
      positions: [{ x: 1, y: 1 }]
    }, { clientId: "A", basis: 2 }))), null);
  });
});
