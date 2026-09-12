// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import {
  BrushStore,
  PresenceStore
} from "../../../../src/app/state/index.ts";
import {
  BlockSelectionPresence
} from "../../../../src/features/blocks/collaboration/BlockSelectionPresence.ts";
import { createRoomHarness } from "../../../collaboration/roomHarness.ts";

function createHarness() {
  const room = createRoomHarness();
  const brush = new BrushStore();
  const presence = new PresenceStore();

  return {
    ...room,
    brush,
    presence,
    blockPresence: new BlockSelectionPresence({
      room: room.room,
      brush,
      presence
    })
  };
}

describe("BlockSelectionPresence", () => {
  it("publishes the local block on construction", () => {
    const harness = createHarness();

    assert.deepEqual(harness.published, [{ block: 1 }]);
    harness.blockPresence.dispose();
  });

  it("republishes the local block on every selection change", () => {
    const harness = createHarness();

    harness.brush.blockId = 4;

    assert.deepEqual(harness.published.at(-1), { block: 4 });
    harness.blockPresence.dispose();
  });

  it("folds the peer blocks into the presence store", () => {
    const harness = createHarness();
    harness.addPeer("bob", { presence: { block: 3 } });
    harness.addPeer("cleo", { presence: { block: 3 } });

    harness.emit("sync");

    assert.deepEqual(
      harness.presence.blockSelections.get(3)?.map((mark) => mark.clientId),
      ["bob", "cleo"]
    );
    harness.blockPresence.dispose();
  });

  it("ignores a block that is not an integer", () => {
    const harness = createHarness();
    harness.addPeer("bob", { presence: { block: "3" } });
    harness.addPeer("cleo", { presence: { block: 1.5 } });

    harness.emit("sync");

    assert.equal(harness.presence.blockSelections.size, 0);
    harness.blockPresence.dispose();
  });

  it("stops publishing the local block once disposed", () => {
    const harness = createHarness();

    harness.blockPresence.dispose();
    harness.published.length = 0;
    harness.brush.blockId = 6;

    assert.deepEqual(harness.published, []);
    assert.equal(harness.presence.blockSelections.size, 0);
  });
});
