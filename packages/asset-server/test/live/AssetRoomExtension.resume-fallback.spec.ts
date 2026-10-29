// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ASSET_UPDATED } from "#src/index.ts";
import { resumeRoom } from "../helpers/live/resumeRoom.ts";

describe("AssetRoomExtension — resume fallback", () => {
  test("falls back to a snapshot for a content change in the range", async() => {
    const { connect, record, send } = resumeRoom();
    await send("peer", 1);
    record({
      eventType: ASSET_UPDATED,
      eventData: {},
      actor: { type: "user", id: "a" }
    });

    const { received, connected } = connect("new", { clientId: "old", version: 0 });
    await connected;

    assert.deepEqual(received, [
      { type: "snapshot", data: { value: 2 }, version: 2 }
    ]);
  });

  test("falls back to a snapshot past the resume limit", async() => {
    const { connect, send } = resumeRoom({ resumeLimit: 2 });
    for (let seq = 1; seq <= 3; seq++) {
      await send("peer", seq);
    }

    const { received, connected } = connect("new", { clientId: "old", version: 0 });
    await connected;

    assert.deepEqual(received, [
      { type: "snapshot", data: { value: 3 }, version: 3 }
    ]);
  });

  test("falls back to a snapshot when compaction removed the range", async() => {
    const { connect, send } = resumeRoom();
    await send("peer", 1);
    await send("peer", 2);

    const { received, connected } = connect("new", { clientId: "old", version: 5 });
    await connected;

    assert.deepEqual(received, [
      { type: "snapshot", data: { value: 2 }, version: 2 }
    ]);
  });

  test("falls back to a snapshot when compaction left a gap after a kept snapshot", async() => {
    const { connect, compact, record, send } = resumeRoom();
    function snapshot(): void {
      record({
        eventType: ASSET_UPDATED,
        eventData: {},
        actor: { type: "system", source: "snapshot" }
      });
    }
    await send("peer", 1);
    await send("peer", 2);
    snapshot();
    for (let seq = 3; seq <= 6; seq++) {
      await send("peer", seq);
    }
    snapshot();
    await send("peer", 7);
    compact(4, 7);

    const { received, connected } = connect("new", { clientId: "old", version: 2 });
    await connected;

    assert.deepEqual(received, [
      { type: "snapshot", data: { value: 9 }, version: 9 }
    ]);
  });
});
