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
import {
  Server,
  UngatedExtensionError
} from "#src/index.ts";
import { actionProtocols } from "../helpers/protocol/protocols.ts";

describe("Server — rights: denied join", () => {
  test(
    "a client denied at join is not a room member, so later messages/presence never reach the extension",
    async() => {
      const server = new Server({ rights: { viewer: { "pixel-draw.$join": "void" } } });
      const extension = new RecordingExtension("pixel-draw", "pixel-draw", actionProtocols);
      server.register(extension);

      const { client, sent } = createClient("A");
      const connectionA = server.connect(client, identityOf(client, "viewer"));
      await connectionA.receive({
        room: "pixel-draw",
        kind: "join"
      });

      assert.deepEqual(extension.connected, []);
      assert.deepEqual(sent, [{
        room: "pixel-draw",
        kind: "denied",
        event: "$join",
        reason: "role \"viewer\" is not permitted to join this room"
      }]);

      await connectionA.receive({
        room: "pixel-draw",
        kind: "message",
        payload: { hello: "world" }
      });
      await connectionA.receive({
        room: "pixel-draw",
        kind: "presence",
        patch: { cursor: { x: 1, y: 1 } }
      });

      assert.deepEqual(extension.messages, []);
    }
  );

  test(
    "one rule covers every room registered under the same extension name, regardless of distinct ids",
    async() => {
      const server = new Server({
        rights: {
          viewer: {
            "voxel.renderer.$join": "write",
            "voxel.renderer.voxel-set": "read"
          }
        }
      });
      const worldOne = new RecordingExtension("voxel-map:world-1", "voxel.renderer", actionProtocols);
      const worldTwo = new RecordingExtension("voxel-map:world-2", "voxel.renderer", actionProtocols);
      server.register(worldOne);
      server.register(worldTwo);

      const a = createClient("A");
      const b = createClient("B");
      const connectionA = server.connect(a.client, identityOf(a.client, "viewer"));
      const connectionB = server.connect(b.client, identityOf(b.client, "viewer"));
      await connectionA.receive({ room: "voxel-map:world-1", kind: "join" });
      await connectionB.receive({ room: "voxel-map:world-2", kind: "join" });
      a.sent.length = 0;
      b.sent.length = 0;

      await connectionA.receive(
        { room: "voxel-map:world-1", kind: "message", payload: { action: "voxel-set" } }
      );
      await connectionB.receive(
        { room: "voxel-map:world-2", kind: "message", payload: { action: "voxel-set" } }
      );

      assert.deepEqual(worldOne.messages, []);
      assert.deepEqual(worldTwo.messages, []);
      for (const [room, sent] of [
        ["voxel-map:world-1", a.sent],
        ["voxel-map:world-2", b.sent]
      ] as const) {
        assert.deepEqual(sent, [{
          room,
          kind: "denied",
          event: "voxel-set",
          reason: "role \"viewer\" cannot write \"voxel-set\""
        }]);
      }
    }
  );
});

describe("Server — rights: extension gating contract", () => {
  test("refuses an extension with no inbound protocol when a rights table is configured", () => {
    const server = new Server({ rights: { viewer: { "pixel-draw.$join": "void" } } });

    assert.throws(
      () => server.register(new RecordingExtension("pixel-draw")),
      UngatedExtensionError
    );
  });

  test("admits an extension with no inbound protocol when no rights table is configured", () => {
    const server = new Server();

    assert.doesNotThrow(
      () => server.register(new RecordingExtension("pixel-draw"))
    );
  });
});
