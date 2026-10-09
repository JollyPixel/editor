// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setTimeout as nextTimer } from "node:timers/promises";

// Import Internal Dependencies
import {
  createClient,
  serverEnvelopeOf,
  withoutSync
} from "../helpers/server/clientHandle.ts";
import { RecordingExtension } from "../helpers/server/RecordingExtension.ts";
import {
  Server,
  type AuthenticationProvider,
  type PeerIdentity,
  type PeerMetadata
} from "#src/index.ts";

describe("Server — profile updates", () => {
  function profiled(
    subject: string
  ): PeerIdentity {
    return {
      subject,
      role: "default",
      profile: {
        username: subject,
        avatar: null
      }
    };
  }

  test("a provider's profile change reaches every member, the subject included", async() => {
    const listeners = new Set<(subject: string, patch: PeerMetadata) => void>();
    const auth: AuthenticationProvider = {
      authenticate: () => null,
      watchProfiles(listener) {
        listeners.add(listener);

        return () => listeners.delete(listener);
      }
    };
    await using server = new Server({ auth });
    server.register(new RecordingExtension("pixel-draw"));
    const a = createClient("A");
    const b = createClient("B");
    const c = createClient("C");
    const connectionA = server.connect(a.client, profiled("alice"));
    const connectionB = server.connect(b.client, profiled("bob"));
    const connectionC = server.connect(c.client, profiled("carol"));
    await connectionA.receive({ room: "pixel-draw", kind: "join" });
    await connectionB.receive({ room: "pixel-draw", kind: "join" });
    a.sent.length = 0;
    b.sent.length = 0;

    for (const listener of listeners) {
      listener("alice", { avatar: "/alice?v=2" });
    }
    await nextTimer(0);
    await connectionC.receive({ room: "pixel-draw", kind: "join" });

    const expected = [
      {
        room: "pixel-draw",
        kind: "peer-profile",
        clientId: "A",
        patch: { avatar: "/alice?v=2" }
      },
      {
        room: "pixel-draw",
        kind: "peer-joined",
        clientId: "C",
        role: "default",
        profile: { username: "carol", avatar: null },
        presence: {}
      }
    ];
    assert.deepEqual(a.sent, expected);
    assert.deepEqual(b.sent, expected);
    const sync = serverEnvelopeOf(c.sent[0]);
    assert.ok(sync.kind === "sync");
    assert.deepEqual(sync.members.map((member) => member.profile), [
      { username: "alice", avatar: "/alice?v=2" },
      { username: "bob", avatar: null },
      { username: "carol", avatar: null }
    ]);
  });

  test("a change that would push a member's profile past the room limit is dropped", async() => {
    await using server = new Server({
      limits: { peerMetadataLength: 64 }
    });
    server.register(new RecordingExtension("voxel"));
    const a = createClient("A");
    const b = createClient("B");
    const connectionA = server.connect(a.client, profiled("alice"));
    const connectionB = server.connect(b.client, profiled("bob"));
    await connectionA.receive({ room: "voxel", kind: "join" });
    await connectionB.receive({ room: "voxel", kind: "join" });
    a.sent.length = 0;

    server.updateProfile("bob", { avatar: `/${"x".repeat(64)}` });
    await nextTimer(0);

    assert.deepEqual(a.sent, []);
  });

  test("a room the subject joins after the change carries the new profile", async() => {
    await using server = new Server();
    server.register(new RecordingExtension("voxel"));
    const a = createClient("A");
    const b = createClient("B");
    const connectionA = server.connect(a.client, profiled("alice"));
    const connectionB = server.connect(b.client, profiled("bob"));
    await connectionB.receive({ room: "voxel", kind: "join" });

    server.updateProfile("alice", { avatar: "/alice?v=2" });
    await nextTimer(0);
    await connectionA.receive({ room: "voxel", kind: "join" });

    assert.deepEqual(withoutSync(b.sent), [{
      room: "voxel",
      kind: "peer-joined",
      clientId: "A",
      role: "default",
      profile: { username: "alice", avatar: "/alice?v=2" },
      presence: {}
    }]);
  });
});
