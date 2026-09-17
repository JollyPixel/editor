// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { editorState, PresenceStore } from "../../src/app/state/index.ts";
import { GroupSelectionPresence } from "../../src/collaboration/GroupSelectionPresence.ts";
import type GroupManager from "../../src/features/groups/GroupManager.ts";
import { createRoomHarness } from "./roomHarness.ts";

function dispatchGroupSelected(
  uuid: string | null
): void {
  const group = uuid === null ?
    null :
    { getGroupUUID: () => uuid } as unknown as GroupManager;

  editorState.modelEvents.emit("groupSelected", { group });
}

function createHarness() {
  const room = createRoomHarness();
  const presence = new PresenceStore();

  return {
    ...room,
    presence,
    groupPresence: new GroupSelectionPresence({
      room: room.room,
      presence
    })
  };
}

describe("GroupSelectionPresence", () => {
  it("publishes null on construction when nothing is selected", () => {
    const harness = createHarness();

    assert.deepEqual(harness.published, [{ block: null }]);
    harness.groupPresence.dispose();
  });

  it("republishes the locally selected group uuid", () => {
    const harness = createHarness();

    dispatchGroupSelected("uuid-1");

    assert.deepEqual(harness.published.at(-1), { block: "uuid-1" });
    harness.groupPresence.dispose();
  });

  it("republishes null once the selection is cleared", () => {
    const harness = createHarness();

    dispatchGroupSelected("uuid-1");
    dispatchGroupSelected(null);

    assert.deepEqual(harness.published.at(-1), { block: null });
    harness.groupPresence.dispose();
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
    harness.groupPresence.dispose();
  });

  it("ignores a selection value that is not a string", () => {
    const harness = createHarness();
    harness.addPeer("bob", { presence: { block: 3 } });

    harness.emit("sync");

    assert.equal(harness.presence.blockSelections.size, 0);
    harness.groupPresence.dispose();
  });

  it("stops publishing and listening once disposed", () => {
    const harness = createHarness();

    harness.groupPresence.dispose();
    harness.published.length = 0;
    dispatchGroupSelected("uuid-9");

    assert.deepEqual(harness.published, []);
    assert.equal(harness.presence.blockSelections.size, 0);
  });
});
