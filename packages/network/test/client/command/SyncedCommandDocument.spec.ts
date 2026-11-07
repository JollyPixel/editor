// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  commandDocumentKind,
  type CommandDocumentKind
} from "#src/client/index.ts";
import { RoomHarness } from "../../helpers/client/RoomHarness.ts";
import {
  ValueDocument,
  type TestCommand,
  type TestMessage
} from "../../helpers/client/ValueDocument.ts";

function valueKind(): CommandDocumentKind<"value", ValueDocument> {
  return commandDocumentKind({
    kind: "value",
    createDocument: () => new ValueDocument(),
    keys: () => null
  });
}

function joinedRoom(): RoomHarness<TestCommand, TestMessage> {
  const harness = new RoomHarness<TestCommand, TestMessage>();
  harness.room.join();
  harness.admit("self");

  return harness;
}

describe("commandDocumentKind", () => {
  test("syncs a fresh document per room, ready once that room's first snapshot lands", async() => {
    const kind = valueKind();
    const first = joinedRoom();
    const second = joinedRoom();
    const a = kind.syncDocument(first.room);
    const b = kind.syncDocument(second.room);

    first.serverMessage({ type: "snapshot", data: { value: 3 } });
    await a.ready;
    a.document.set(4);

    assert.equal(kind.kind, "value");
    assert.equal(a.loaded, true);
    assert.equal(b.loaded, false);
    assert.equal(b.document.value, 0);
    assert.equal(a.pendingChanges.pending, 1);
    assert.deepEqual(second.messages, []);
  });

  test("loads what resolveSnapshot resolves from the received snapshot and its room", async() => {
    const harness = joinedRoom();
    const kind: CommandDocumentKind<"value", ValueDocument> = commandDocumentKind({
      kind: "value",
      createDocument: () => new ValueDocument(),
      keys: () => null,
      resolveSnapshot: (received, room) => Promise.resolve({
        value: (received as { ref: number; }).ref * (room === harness.room ? 10 : 0)
      })
    });
    const synced = kind.syncDocument(harness.room);

    harness.serverMessage({ type: "snapshot", data: { ref: 4 } as never });
    assert.equal(synced.document.value, 0);
    await synced.ready;

    assert.equal(synced.document.value, 40);
  });

  test("dispose stops the document from following its room", async() => {
    const harness = joinedRoom();
    const synced = valueKind().syncDocument(harness.room);
    harness.serverMessage({ type: "snapshot", data: { value: 3 } });
    await synced.ready;

    synced.dispose();
    harness.serverMessage({ type: "snapshot", data: { value: 9 } });

    assert.equal(synced.document.value, 3);
  });
});
