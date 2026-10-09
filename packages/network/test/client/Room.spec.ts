// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { MessageParser } from "#src/index.ts";
import { createOpenClient } from "../helpers/client/FakeSocket.ts";
import { actionCommandProtocol } from "../helpers/protocol/protocols.ts";

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

describe("Room — resync", () => {
  test("sends a resync envelope once joined and nothing before", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");

    room.resync();
    room.join();
    room.resync();

    assert.deepEqual(
      socket.sent.map((raw) => JSON.parse(raw)),
      [
        { room: "pixel-draw", kind: "join", profile: {}, presence: {} },
        { room: "pixel-draw", kind: "resync" }
      ]
    );
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
