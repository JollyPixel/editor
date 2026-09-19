// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { BlockSelectionPresence } from "#src/collaboration/BlockSelectionPresence.ts";
import { ModelBlocks } from "#src/model/index.ts";
import { PresenceStore } from "#src/state/index.ts";
import { createRoomHarness } from "./roomHarness.ts";

function createHarness() {
  const room = createRoomHarness();
  const presence = new PresenceStore();
  const blocks = new ModelBlocks(new THREE.Scene());

  return {
    ...room,
    blocks,
    presence,
    selections: new BlockSelectionPresence({
      room: room.room,
      blocks,
      presence
    })
  };
}

describe("BlockSelectionPresence", () => {
  it("publishes null on construction when nothing is selected", () => {
    const harness = createHarness();

    assert.deepEqual(harness.published, [{ block: null }]);
    harness.selections.dispose();
  });

  it("publishes the locally selected block, then null once cleared", () => {
    const harness = createHarness();
    const block = harness.blocks.add();

    harness.blocks.select(block);
    assert.deepEqual(harness.published.at(-1), { block: block.uuid });

    harness.blocks.select(null);
    assert.deepEqual(harness.published.at(-1), { block: null });
    harness.selections.dispose();
  });

  it("folds the peer selections into the presence store", () => {
    const harness = createHarness();
    harness.addPeer("bob", { presence: { block: "uuid-3" } });
    harness.addPeer("cleo", { presence: { block: "uuid-3" } });

    harness.emit("sync");

    assert.deepEqual(
      harness.presence.blockSelections.get("uuid-3")?.map((mark) => mark.clientId),
      ["bob", "cleo"]
    );
    harness.selections.dispose();
  });

  it("ignores a selection value that is not a string", () => {
    const harness = createHarness();
    harness.addPeer("bob", { presence: { block: 3 } });

    harness.emit("sync");

    assert.equal(harness.presence.blockSelections.size, 0);
    harness.selections.dispose();
  });

  it("stops publishing and listening once disposed", () => {
    const harness = createHarness();

    harness.selections.dispose();
    harness.published.length = 0;
    harness.blocks.select(harness.blocks.add());

    assert.deepEqual(harness.published, []);
    assert.equal(harness.presence.blockSelections.size, 0);
  });
});
