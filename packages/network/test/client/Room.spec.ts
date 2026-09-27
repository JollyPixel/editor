// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { MessageParser } from "#src/index.ts";
import { createOpenClient } from "../helpers/FakeSocket.ts";
import { actionCommandProtocol } from "../helpers/protocols.ts";

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

describe("Room — leave", () => {
  function admit(
    socket: ReturnType<typeof createOpenClient>["socket"]
  ): void {
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
  }

  test("sends leave once joined, resets the admitted state and emits \"left\"", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    room.join();
    admit(socket);
    let left = 0;
    room.on("left", () => left++);

    room.leave();
    room.leave();

    assert.deepEqual(
      socket.sent.map((raw) => JSON.parse(raw)).at(-1),
      { room: "pixel-draw", kind: "leave" }
    );
    assert.equal(left, 1);
    assert.equal(room.peers.size, 0);
    assert.strictEqual(room.clientId, null);
    assert.equal(room.role, "default");
    assert.equal(room.access, "void");
  });

  test("sends nothing when the room was never joined", () => {
    const { client, socket } = createOpenClient();

    client.room("pixel-draw").leave();

    assert.deepEqual(socket.sent, []);
  });

  test("a left handle refuses to rejoin and stops receiving envelopes", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    room.join();
    room.leave();

    admit(socket);

    assert.throws(() => room.join(), /was left/);
    assert.equal(room.peers.size, 0);
    assert.notStrictEqual(client.room("pixel-draw"), room);
  });
});

describe("Room — denied", () => {
  test("fires \"denied\" with the event name and reason", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    const denials: { event: string; reason: string; }[] = [];
    room.on("denied", (event) => denials.push(event));

    socket.receive({
      room: "pixel-draw",
      kind: "denied",
      event: "$join",
      reason: "role \"viewer\" is not permitted to join this room"
    });

    assert.deepEqual(denials, [{
      event: "$join",
      reason: "role \"viewer\" is not permitted to join this room"
    }]);
  });
});

describe("Room — error", () => {
  test("fires \"error\" with the event name and reason, distinct from \"denied\"", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    const errors: { event: string; reason: string; }[] = [];
    const denials: { event: string; reason: string; }[] = [];
    room.on("error", (event) => errors.push(event));
    room.on("denied", (event) => denials.push(event));

    socket.receive({
      room: "pixel-draw",
      kind: "error",
      event: "pixel-set",
      reason: "disk full"
    });

    assert.deepEqual(errors, [{
      event: "pixel-set",
      reason: "disk full"
    }]);
    assert.deepEqual(denials, []);
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

describe("Room — room parser", () => {
  test("emits parsed messages and reports rejected payloads as \"malformed\"", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw", {
      parser: new MessageParser(actionCommandProtocol)
    });
    room.join();

    const messages: unknown[] = [];
    const malformed: unknown[] = [];
    room.on("message", (payload) => messages.push(payload));
    room.on("malformed", (event) => malformed.push(event.payload));

    socket.receive({
      room: "pixel-draw",
      kind: "message",
      payload: { action: "voxel-set" }
    });
    socket.receive({
      room: "pixel-draw",
      kind: "message",
      payload: { action: "unheard-of" }
    });

    assert.deepEqual(messages, [{ action: "voxel-set" }]);
    assert.deepEqual(malformed, [{ action: "unheard-of" }]);
  });

  test("passes payloads straight through when no parser is supplied", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    room.join();

    const messages: unknown[] = [];
    room.on("message", (payload) => messages.push(payload));

    socket.receive({
      room: "pixel-draw",
      kind: "message",
      payload: { anything: true }
    });

    assert.deepEqual(messages, [{ anything: true }]);
  });
});
