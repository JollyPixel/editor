// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ASSET_UPDATED } from "#src/index.ts";
import { resumeRoom } from "../helpers/live/resumeRoom.ts";

describe("AssetRoomExtension — resume", () => {
  test("answers with the commands after the resumed version and the previous ack", async() => {
    const { extension, connect, send } = resumeRoom();
    await connect("old").connected;
    send("old", 1);
    send("peer", 1);
    send("old", 2);
    extension.onClientDisconnect("old");

    const { received, connected } = connect("new", { clientId: "old", version: 1 });
    await connected;

    assert.deepEqual(received, [
      {
        type: "catch-up",
        data: [
          { action: "increment", seq: 1, clientId: "peer" },
          { action: "increment", seq: 2, clientId: "old" }
        ],
        version: 3,
        acks: { old: 2 }
      }
    ]);
  });

  test("skips renames and scheduled snapshots in the range", async() => {
    const { connect, record, send } = resumeRoom();
    send("peer", 1);
    record({
      eventType: "asset.renamed",
      eventData: {},
      actor: { type: "user", id: "a" }
    });
    record({
      eventType: ASSET_UPDATED,
      eventData: {},
      actor: { type: "system", source: "snapshot" }
    });

    const { received, connected } = connect("new", { clientId: "old", version: 0 });
    await connected;

    assert.deepEqual(received, [
      {
        type: "catch-up",
        data: [{ action: "increment", seq: 1, clientId: "peer" }],
        version: 3
      }
    ]);
  });

  test("answers a resume without a version with an acknowledging snapshot", async() => {
    const { extension, connect, send } = resumeRoom();
    await connect("old").connected;
    send("old", 4);
    extension.onClientDisconnect("old");

    const { received, connected } = connect("new", { clientId: "old" });
    await connected;

    assert.deepEqual(received, [
      { type: "snapshot", data: { value: 1 }, version: 1, acks: { old: 4 } }
    ]);
  });

  test("waits for the previous connection to leave before answering", async() => {
    const { extension, connect, send } = resumeRoom();
    await connect("old").connected;

    const { received, connected } = connect("new", { clientId: "old", version: 0 });
    send("old", 1);
    assert.deepEqual(received, []);
    extension.onClientDisconnect("old");
    await connected;

    assert.deepEqual(received, [
      {
        type: "catch-up",
        data: [{ action: "increment", seq: 1, clientId: "old" }],
        version: 1,
        acks: { old: 1 }
      }
    ]);
  });

  test("stops waiting for the previous connection after the timeout", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { connect } = resumeRoom({ departureTimeout: 50 });
    await connect("old").connected;

    const { received, connected } = connect("new", { clientId: "old", version: 0 });
    t.mock.timers.tick(50);
    await connected;

    assert.deepEqual(received, [
      { type: "catch-up", data: [], version: 0 }
    ]);
  });

  test("a join without resume gets a snapshot with the room version", async() => {
    const { connect, send } = resumeRoom();
    send("peer", 1);

    const { received, connected } = connect("new");
    await connected;

    assert.deepEqual(received, [
      { type: "snapshot", data: { value: 1 }, version: 1 }
    ]);
  });

  test("a malformed resume is answered like a fresh join", async() => {
    const { connect, send } = resumeRoom();
    send("old", 4);

    const { received, connected } = connect("new", {
      clientId: "old",
      version: 0.5
    });
    await connected;

    assert.deepEqual(received, [
      { type: "snapshot", data: { value: 1 }, version: 1 }
    ]);
  });
});
