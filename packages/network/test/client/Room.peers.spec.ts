// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createOpenClient } from "../helpers/client/FakeSocket.ts";

describe("Room — peers mirror", () => {
  test("populates peers from a sync envelope", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    assert.strictEqual(room.clientId, null);

    socket.receive({
      room: "pixel-draw",
      kind: "sync",
      self: "A",
      rights: { "voxel-set": "read" },
      members: [
        {
          clientId: "B",
          role: "viewer",
          profile: { username: "bob" },
          presence: { cursor: { x: 1, y: 2 } }
        }
      ]
    });

    assert.deepEqual([...room.peers.entries()], [
      [
        "B",
        {
          clientId: "B",
          role: "viewer",
          profile: { username: "bob" },
          presence: { cursor: { x: 1, y: 2 } }
        }
      ]
    ]);
    assert.strictEqual(room.clientId, "A");
    assert.strictEqual(room.can("voxel-set"), "read");
    assert.strictEqual(room.can("unknown"), "void");
    assert.strictEqual(room.access, "read");
  });

  test("keeps the local client out of peers while adopting its own role", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    const synced: string[][] = [];
    room.on("sync", (event) => synced.push(event.clientIds));

    socket.receive({
      room: "pixel-draw",
      kind: "sync",
      self: "A",
      rights: { "voxel-set": "write" },
      members: [
        { clientId: "A", role: "editor", profile: {}, presence: {} },
        { clientId: "B", role: "viewer", profile: {}, presence: {} }
      ]
    });

    assert.deepEqual([...room.peers.keys()], ["B"]);
    assert.deepEqual(synced, [["B"]]);
    assert.strictEqual(room.role, "editor");
    assert.strictEqual(room.access, "write");
  });

  test("peer-joined adds to peers and fires \"peer-joined\"", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    const joined: string[] = [];
    room.on("peer-joined", (event) => joined.push(event.clientId));

    socket.receive({
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      role: "editor",
      profile: { username: "bob" },
      presence: {}
    });

    assert.deepEqual(joined, ["B"]);
    assert.deepEqual(room.peers.get("B"), {
      clientId: "B",
      role: "editor",
      profile: { username: "bob" },
      presence: {}
    });
  });

  test("peer-left removes from peers and fires \"peer-left\"", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    const left: string[] = [];
    room.on("peer-left", (event) => left.push(event.clientId));

    socket.receive({
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      role: "default",
      profile: {},
      presence: {}
    });
    socket.receive({
      room: "pixel-draw",
      kind: "peer-left",
      clientId: "B"
    });

    assert.deepEqual(left, ["B"]);
    assert.equal(room.peers.has("B"), false);
  });

  test("peer-presence merges into the existing peer's presence and fires \"peer-presence\"", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    const updates: { clientId: string; patch: unknown; }[] = [];
    room.on("peer-presence", (event) => updates.push({
      clientId: event.clientId,
      patch: event.patch
    }));

    socket.receive({
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      role: "default",
      profile: { username: "bob" },
      presence: {}
    });
    socket.receive({
      room: "pixel-draw",
      kind: "peer-presence",
      clientId: "B",
      patch: { cursor: { x: 3, y: 4 } }
    });

    assert.deepEqual(updates, [{ clientId: "B", patch: { cursor: { x: 3, y: 4 } } }]);
    assert.deepEqual(room.peers.get("B")?.presence, { cursor: { x: 3, y: 4 } });
  });

  test("peer-presence replaces the peer instead of mutating it", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    socket.receive({
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      role: "default",
      profile: {},
      presence: {}
    });
    const before = room.peers.get("B");

    socket.receive({
      room: "pixel-draw",
      kind: "peer-presence",
      clientId: "B",
      patch: { tool: "fill" }
    });

    assert.deepEqual(before?.presence, {});
    assert.notStrictEqual(room.peers.get("B"), before);
  });

  test("sync replaces the peers cached before it", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    socket.receive({
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "X",
      role: "default",
      profile: {},
      presence: {}
    });

    socket.receive({
      room: "pixel-draw",
      kind: "sync",
      self: "A",
      rights: {},
      members: [
        { clientId: "B", role: "default", profile: {}, presence: {} }
      ]
    });

    assert.deepEqual([...room.peers.keys()], ["B"]);
  });
});

describe("Room — updatePresence", () => {
  test("sends a presence envelope carrying the patch once joined", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    room.join();
    socket.sent.length = 0;

    room.updatePresence({ cursor: { x: 9, y: 9 } });

    assert.deepEqual(
      socket.sent.map((raw) => JSON.parse(raw)),
      [{ room: "pixel-draw", kind: "presence", patch: { cursor: { x: 9, y: 9 } } }]
    );
  });

  test("merges presence set before join into the join envelope", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");

    room.updatePresence({ cursor: { x: 1, y: 1 } });
    room.updatePresence({ cursor: null, tool: "brush" });
    assert.deepEqual(socket.sent, []);

    room.join();

    assert.deepEqual(
      socket.sent.map((raw) => JSON.parse(raw)),
      [{
        room: "pixel-draw",
        kind: "join",
        profile: {},
        presence: { cursor: null, tool: "brush" }
      }]
    );
  });

  test("peer-joined seeds the peer presence", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");

    socket.receive({
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      role: "default",
      profile: {},
      presence: { cursor: { x: 4, y: 5 } }
    });

    assert.deepEqual(room.peers.get("B")?.presence, { cursor: { x: 4, y: 5 } });
  });
});
