// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { identityOf } from "../helpers/server/identity.ts";
import { createClient } from "../helpers/server/clientHandle.ts";
import { RecordingExtension } from "../helpers/server/RecordingExtension.ts";
import { Server } from "#src/index.ts";

describe("Server", () => {
  test("does not notify an extension until the client joins its room", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client } = createClient("A");
    const connectionA = server.connect(client, identityOf(client));
    assert.deepEqual(extension.connected, []);

    await connectionA.receive({ room: "pixel-draw", kind: "join" });
    assert.deepEqual(extension.connected, ["A"]);
  });

  test("routes messages only to the joined extension", async() => {
    const server = new Server();
    const pixel = new RecordingExtension("pixel-draw");
    const voxel = new RecordingExtension("voxel");
    server.register(pixel);
    server.register(voxel);

    const { client } = createClient("A");
    const connectionA = server.connect(client, identityOf(client));
    await connectionA.receive({ room: "pixel-draw", kind: "join" });
    await connectionA.receive({
      room: "pixel-draw",
      kind: "message",
      payload: { hello: "world" }
    });
    await connectionA.receive({
      room: "voxel",
      kind: "message",
      payload: { should: "be dropped" }
    });

    assert.deepEqual(pixel.messages, [{ clientId: "A", payload: { hello: "world" } }]);
    assert.deepEqual(voxel.messages, []);
  });

  test("leave notifies the extension once and stops routing further messages", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client } = createClient("A");
    const connectionA = server.connect(client, identityOf(client));
    await connectionA.receive({ room: "pixel-draw", kind: "join" });
    await connectionA.receive({ room: "pixel-draw", kind: "leave" });
    await connectionA.receive({
      room: "pixel-draw",
      kind: "message",
      payload: {}
    });

    assert.deepEqual(extension.disconnected, ["A"]);
    assert.deepEqual(extension.messages, []);
  });

  test("disconnect notifies only extensions the client had joined", async() => {
    const server = new Server();
    const pixel = new RecordingExtension("pixel-draw");
    const voxel = new RecordingExtension("voxel");
    server.register(pixel);
    server.register(voxel);

    const { client } = createClient("A");
    const connectionA = server.connect(client, identityOf(client));
    await connectionA.receive({ room: "pixel-draw", kind: "join" });
    await connectionA.close();

    assert.deepEqual(pixel.disconnected, ["A"]);
    assert.deepEqual(voxel.disconnected, []);
  });

  test("a closing connection drops the envelopes it receives and disconnects once", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client } = createClient("A");
    const connectionA = server.connect(client, identityOf(client));
    await connectionA.receive({ room: "pixel-draw", kind: "join" });
    const closing = connectionA.close();
    await connectionA.receive({ room: "pixel-draw", kind: "message", payload: {} });
    await Promise.all([closing, connectionA.close()]);

    assert.deepEqual(extension.disconnected, ["A"]);
    assert.deepEqual(extension.messages, []);
  });

  test("drops an envelope of a kind only the server originates", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client } = createClient("A");
    const connectionA = server.connect(client, identityOf(client));

    await connectionA.receive({ room: "pixel-draw", kind: "join" });
    await connectionA.receive({
      room: "pixel-draw",
      kind: "peer-left",
      clientId: "B"
    });

    assert.deepEqual(extension.messages, []);
  });
});

describe("Server — RoomContext identity", () => {
  test("hands extensions the identity the connection was admitted with", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const { client } = createClient("A");
    const connectionA = server.connect(client, { subject: "alice", role: "default" });
    await connectionA.receive({ room: "pixel-draw", kind: "join" });

    assert.deepEqual(extension.contexts.at(-1)?.identity, {
      subject: "alice",
      role: "default"
    });
  });
});
