// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { identityOf } from "../helpers/server/identity.ts";
import {
  createClient,
  withoutSync
} from "../helpers/server/clientHandle.ts";
import { RecordingExtension } from "../helpers/server/RecordingExtension.ts";
import { Server } from "#src/index.ts";

describe("Server — peer presence", () => {
  test("notifies remaining members when a client disconnects", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    const connectionA = server.connect(a.client, identityOf(a.client));
    const connectionB = server.connect(b.client, identityOf(b.client));
    await connectionA.receive({ room: "pixel-draw", kind: "join" });
    await connectionB.receive({ room: "pixel-draw", kind: "join" });
    a.sent.length = 0;

    await connectionB.close();

    assert.deepEqual(a.sent, [{ room: "pixel-draw", kind: "peer-left", clientId: "B" }]);
  });

  test("a member whose onClientConnect failed still leaves on disconnect", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    const connectionA = server.connect(a.client, identityOf(a.client));
    const connectionB = server.connect(b.client, identityOf(b.client));
    await connectionA.receive({ room: "pixel-draw", kind: "join" });
    extension.onClientConnect = () => {
      throw new Error("snapshot unavailable");
    };
    await connectionB.receive({ room: "pixel-draw", kind: "join" });
    a.sent.length = 0;

    await connectionB.close();

    assert.deepEqual(a.sent, [{ room: "pixel-draw", kind: "peer-left", clientId: "B" }]);
    assert.deepEqual(extension.disconnected, ["B"]);
  });

  test("does not leak peer events across rooms", async() => {
    const server = new Server();
    const pixel = new RecordingExtension("pixel-draw");
    const voxel = new RecordingExtension("voxel");
    server.register(pixel);
    server.register(voxel);

    const a = createClient("A");
    const b = createClient("B");
    const connectionA = server.connect(a.client, identityOf(a.client));
    const connectionB = server.connect(b.client, identityOf(b.client));
    await connectionA.receive({ room: "voxel", kind: "join" });

    await connectionB.receive({ room: "pixel-draw", kind: "join" });

    assert.deepEqual(withoutSync(a.sent), []);
  });
});

describe("Server — peer metadata", () => {
  test("the identity profile overrides the fields a joiner claims and keeps the others", async() => {
    const server = new Server();
    server.register(new RecordingExtension("pixel-draw"));

    const a = createClient("A");
    const b = createClient("B");
    const connectionA = server.connect(a.client, identityOf(a.client));
    const connectionB = server.connect(b.client, {
      ...identityOf(b.client),
      profile: { username: "bob" }
    });
    await connectionA.receive({ room: "pixel-draw", kind: "join" });

    await connectionB.receive({
      room: "pixel-draw",
      kind: "join",
      profile: {
        username: "alice",
        color: "red"
      }
    });

    assert.deepEqual(withoutSync(a.sent), [{
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      role: "default",
      profile: {
        username: "bob",
        color: "red"
      },
      presence: {}
    }]);
  });

  test("a joiner with existing members receives a sync snapshot of their profile and presence", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    const connectionA = server.connect(a.client, identityOf(a.client));
    const connectionB = server.connect(b.client, identityOf(b.client));
    await connectionA.receive({
      room: "pixel-draw",
      kind: "join",
      profile: { username: "alice" }
    });
    await connectionA.receive({
      room: "pixel-draw",
      kind: "presence",
      patch: { cursor: { x: 1, y: 2 } }
    });
    b.sent.length = 0;

    await connectionB.receive({ room: "pixel-draw", kind: "join" });

    assert.deepEqual(b.sent, [{
      room: "pixel-draw",
      kind: "sync",
      self: "B",
      rights: { $presence: "write" },
      members: [
        {
          clientId: "A",
          role: "default",
          profile: { username: "alice" },
          presence: { cursor: { x: 1, y: 2 } }
        },
        {
          clientId: "B",
          role: "default",
          profile: Object.create(null),
          presence: {}
        }
      ]
    }]);
  });

  test("identity and presence are gone from the sync snapshot after leave/disconnect", async() => {
    const server = new Server();
    const extension = new RecordingExtension("pixel-draw");
    server.register(extension);

    const a = createClient("A");
    const b = createClient("B");
    const c = createClient("C");
    const connectionA = server.connect(a.client, identityOf(a.client));
    const connectionB = server.connect(b.client, identityOf(b.client));
    const connectionC = server.connect(c.client, identityOf(c.client));
    await connectionA.receive({
      room: "pixel-draw",
      kind: "join",
      profile: { username: "alice" }
    });
    await connectionB.receive({
      room: "pixel-draw",
      kind: "join",
      profile: { username: "bob" }
    });
    await connectionA.receive({ room: "pixel-draw", kind: "leave" });
    await connectionB.close();

    await connectionC.receive({ room: "pixel-draw", kind: "join" });

    assert.deepEqual(c.sent, [{
      room: "pixel-draw",
      kind: "sync",
      self: "C",
      rights: { $presence: "write" },
      members: [
        {
          clientId: "C",
          role: "default",
          profile: Object.create(null),
          presence: {}
        }
      ]
    }]);
  });
});
