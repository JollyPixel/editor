// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PresenceChannel,
  type PresenceChange
} from "#src/index.ts";
import { FakeRoom } from "../helpers/FakeRoom.ts";

function decodeTool(
  value: unknown
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function setup(
  room = new FakeRoom()
) {
  const channel = new PresenceChannel(room, {
    key: "tool",
    decode: decodeTool
  });
  const changes: PresenceChange<string>[] = [];
  channel.on("change", (change) => changes.push(change));

  return {
    room,
    channel,
    changes
  };
}

describe("PresenceChannel", () => {
  test("replays the peers already in the room", () => {
    const room = new FakeRoom();
    room.addPeer("B", { tool: "brush" });
    room.addPeer("C", {});

    const channel = new PresenceChannel(room, {
      key: "tool",
      decode: decodeTool
    });

    assert.deepEqual([...channel.values], [["B", "brush"]]);
  });

  test("applies patches carrying its key and ignores the others", () => {
    const { room, channel, changes } = setup();
    room.addPeer("B");

    room.presence("B", { cursor: { x: 1, y: 1 } });
    room.presence("B", { tool: "fill" });

    assert.deepEqual(changes, [{ clientId: "B", value: "fill" }]);
    assert.strictEqual(channel.values.get("B"), "fill");
  });

  test("an undecodable value removes the peer value", () => {
    const { room, channel, changes } = setup();
    room.addPeer("B", { tool: "brush" });
    room.emit("peer-joined", { clientId: "B" });

    room.presence("B", { tool: null });
    room.presence("B", { tool: 42 });

    assert.deepEqual(changes, [
      { clientId: "B", value: "brush" },
      { clientId: "B", value: undefined }
    ]);
    assert.strictEqual(channel.values.has("B"), false);
  });

  test("peer-joined reads the join presence", () => {
    const { room, changes } = setup();
    room.addPeer("B", { tool: "line" });

    room.emit("peer-joined", { clientId: "B" });

    assert.deepEqual(changes, [{ clientId: "B", value: "line" }]);
  });

  test("peer-left removes the peer value", () => {
    const { room, channel, changes } = setup();
    room.addPeer("B", { tool: "brush" });
    room.emit("peer-joined", { clientId: "B" });

    room.removePeer("B");

    assert.deepEqual(changes.at(-1), { clientId: "B", value: undefined });
    assert.strictEqual(channel.values.size, 0);
  });

  test("sync replays members and drops peers that are gone", () => {
    const { room, channel, changes } = setup();
    room.addPeer("B", { tool: "brush" });
    room.emit("peer-joined", { clientId: "B" });
    room.peers.clear();
    room.addPeer("C", { tool: "fill" });

    room.emit("sync", { self: "self", clientIds: ["C"] });

    assert.deepEqual(changes.slice(1), [
      { clientId: "B", value: undefined },
      { clientId: "C", value: "fill" }
    ]);
    assert.deepEqual([...channel.values], [["C", "fill"]]);
  });

  test("publish skips a value equal to the last published one", () => {
    const room = new FakeRoom();
    const channel = new PresenceChannel(room, {
      key: "cursor",
      decode: (value): { x: number; } | undefined => value as { x: number; },
      equals: (left, right) => left.x === right.x
    });

    assert.strictEqual(channel.publish({ x: 1 }), true);
    assert.strictEqual(channel.publish({ x: 1 }), false);
    assert.strictEqual(channel.publish({ x: 2 }), true);

    assert.deepEqual(room.patches, [
      { cursor: { x: 1 } },
      { cursor: { x: 2 } }
    ]);
  });

  test("destroy removes every value and stops listening", () => {
    const { room, channel, changes } = setup();
    room.addPeer("B", { tool: "brush" });
    room.emit("peer-joined", { clientId: "B" });

    channel.destroy();
    room.presence("B", { tool: "fill" });

    assert.deepEqual(changes, [
      { clientId: "B", value: "brush" },
      { clientId: "B", value: undefined }
    ]);
    assert.strictEqual(channel.values.size, 0);
  });
});
