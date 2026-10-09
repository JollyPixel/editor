// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createOpenClient } from "../helpers/client/FakeSocket.ts";

describe("Room — profiles", () => {
  test("peer-profile merges into the peer's profile and fires \"peer-profile\"", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    const updates: { clientId: string; patch: unknown; }[] = [];
    room.on("peer-profile", (event) => updates.push({
      clientId: event.clientId,
      patch: event.patch
    }));
    socket.receive({
      room: "pixel-draw",
      kind: "peer-joined",
      clientId: "B",
      role: "default",
      profile: { username: "bob", avatar: null },
      presence: {}
    });

    socket.receive({
      room: "pixel-draw",
      kind: "peer-profile",
      clientId: "B",
      patch: { avatar: "/avatar?v=2" }
    });

    assert.deepEqual(updates, [{ clientId: "B", patch: { avatar: "/avatar?v=2" } }]);
    assert.deepEqual(room.peers.get("B")?.profile, {
      username: "bob",
      avatar: "/avatar?v=2"
    });
  });

  test("adopts its own admitted profile and the peer-profile patches addressed to it", () => {
    const { client, socket } = createOpenClient();
    const room = client.room("pixel-draw");
    const updated: string[] = [];
    room.on("peer-profile", (event) => updated.push(event.clientId));
    assert.strictEqual(room.profile, null);

    socket.receive({
      room: "pixel-draw",
      kind: "sync",
      self: "A",
      rights: {},
      members: [
        {
          clientId: "A",
          role: "default",
          profile: { username: "ada", avatar: null },
          presence: {}
        }
      ]
    });
    socket.receive({
      room: "pixel-draw",
      kind: "peer-profile",
      clientId: "A",
      patch: { avatar: "/avatar?v=1" }
    });

    assert.deepEqual(room.profile, { username: "ada", avatar: "/avatar?v=1" });
    assert.deepEqual([...room.peers.keys()], []);
    assert.deepEqual(updated, ["A"]);
  });
});
