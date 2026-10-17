// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createClient } from "../helpers/server/clientHandle.ts";
import { RecordingExtension } from "../helpers/server/RecordingExtension.ts";
import {
  Server,
  type PeerIdentity,
  type RoomAdmission
} from "#src/index.ts";

// CONSTANTS
const kGuest: PeerIdentity = {
  subject: "link:1",
  role: "guest"
};

function scopedTo(
  ...rooms: string[]
): RoomAdmission {
  return (_identity, room) => rooms.includes(room);
}

describe("Server — room admission", () => {
  test("a room the admission refuses denies the join", async() => {
    await using server = new Server({ admits: scopedTo("map") });
    const map = new RecordingExtension("map");
    const blockset = new RecordingExtension("blockset");
    server.register(map);
    server.register(blockset);
    const guest = createClient("G");
    const connection = server.connect(guest.client, kGuest);

    await connection.receive({ room: "blockset", kind: "join" });
    await connection.receive({ room: "map", kind: "join" });

    assert.deepEqual(guest.sent[0], {
      room: "blockset",
      kind: "denied",
      event: "$join",
      reason: "identity does not cover this room"
    });
    assert.deepEqual(blockset.peers, []);
    assert.deepEqual(map.peers.map((peer) => peer.clientId), ["G"]);
  });

  test("a refused room is never resolved", async() => {
    await using server = new Server({ admits: scopedTo() });
    const resolved: string[] = [];
    server.useRoomResolver((room) => {
      resolved.push(room);

      return null;
    });
    const guest = createClient("G");
    const connection = server.connect(guest.client, kGuest);

    await connection.receive({ room: "asset:map:1", kind: "join" });

    assert.deepEqual(resolved, []);
  });

  test("an admission that throws refuses the join", async() => {
    await using server = new Server({
      admits: () => {
        throw new Error("catalog closed");
      }
    });
    const map = new RecordingExtension("map");
    server.register(map);
    const guest = createClient("G");
    const connection = server.connect(guest.client, kGuest);

    await connection.receive({ room: "map", kind: "join" });

    assert.deepEqual(map.peers, []);
  });
});
