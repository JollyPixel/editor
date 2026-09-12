// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import {
  PresenceStore,
  SelectionStore
} from "../../../../src/app/state/index.ts";
import {
  LayerSelectionPresence
} from "../../../../src/features/layers/collaboration/LayerSelectionPresence.ts";
import { createRoomHarness } from "../../../collaboration/roomHarness.ts";

function createHarness() {
  const room = createRoomHarness();
  const selection = new SelectionStore();
  const presence = new PresenceStore();

  return {
    ...room,
    selection,
    presence,
    layerPresence: new LayerSelectionPresence({
      room: room.room,
      selection,
      presence
    })
  };
}

describe("LayerSelectionPresence", () => {
  it("publishes null while nothing is selected", () => {
    const harness = createHarness();

    assert.deepEqual(harness.published, [{ layer: null }]);
    harness.layerPresence.dispose();
  });

  it("republishes on every selection change", () => {
    const harness = createHarness();

    harness.selection.selectVoxelLayer("Ground");
    harness.selection.selectObjectLayer("Props");
    harness.selection.selectObject({
      layerName: "Props",
      objectId: "abc"
    });

    assert.deepEqual(harness.published.slice(1), [
      { layer: "voxel-layer:Ground" },
      { layer: "object-layer:Props" },
      { layer: "object:abc" }
    ]);
    harness.layerPresence.dispose();
  });

  it("publishes null again when the selection is cleared", () => {
    const harness = createHarness();
    harness.selection.selectVoxelLayer("Ground");

    harness.selection.clear();

    assert.deepEqual(harness.published.at(-1), { layer: null });
    harness.layerPresence.dispose();
  });

  it("folds the peer selections into the presence store", () => {
    const harness = createHarness();
    harness.addPeer("bob", {
      profile: { username: "Bob", peerId: "bob" },
      presence: { layer: "voxel-layer:Ground" }
    });
    harness.addPeer("cleo", {
      profile: { username: "Cleo", peerId: "cleo" },
      presence: { layer: "object:abc" }
    });

    harness.emit("sync");

    assert.deepEqual(
      [...harness.presence.layerSelections].map(([key, marks]) => [
        key,
        marks.map((mark) => mark.displayName)
      ]),
      [
        ["voxel-layer:Ground", ["Bob"]],
        ["object:abc", ["Cleo"]]
      ]
    );
    harness.layerPresence.dispose();
  });

  it("stops publishing the local selection once disposed", () => {
    const harness = createHarness();

    harness.layerPresence.dispose();
    harness.published.length = 0;
    harness.selection.selectVoxelLayer("Ground");

    assert.deepEqual(harness.published, []);
    assert.equal(harness.presence.layerSelections.size, 0);
  });
});
