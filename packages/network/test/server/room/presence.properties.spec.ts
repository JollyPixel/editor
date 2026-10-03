// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import { setImmediate } from "node:timers/promises";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import {
  Server,
  Client,
  LoopbackTransport,
  type PeerMetadata,
  type Room
} from "#src/index.ts";
import { RecordingExtension } from "../../helpers/server/RecordingExtension.ts";
import {
  wireCopy,
  metadata
} from "../../helpers/arbitraries/json.ts";

// CONSTANTS
const kRoom = "presence";
const kRuns = 50;
const kMembers = 3;

type PresenceAction =
  | { type: "join"; member: number; }
  | { type: "patch"; member: number; patch: PeerMetadata; }
  | { type: "leave"; member: number; };

class PresenceMember {
  readonly client: Client;
  readonly room: Room;
  expected: PeerMetadata = {};
  state: "idle" | "joined" | "left" = "idle";

  constructor(
    transport: LoopbackTransport
  ) {
    this.client = new Client({
      reconnect: false,
      socket: () => transport.connect()
    });
    this.room = this.client.room(kRoom);
  }

  apply(
    action: PresenceAction
  ): void {
    if (this.state === "left") {
      return;
    }

    switch (action.type) {
      case "join":
        this.room.join();
        this.state = "joined";
        break;
      case "patch":
        this.room.updatePresence(action.patch);
        this.expected = {
          ...this.expected,
          ...action.patch
        };
        break;
      case "leave":
        this.room.leave();
        this.state = "left";
        break;
      default:
    }
  }

  assertSees(
    peers: readonly PresenceMember[]
  ): void {
    for (const peer of peers) {
      if (peer === this) {
        continue;
      }

      const clientId = peer.room.clientId;
      assert.ok(clientId !== null);
      assert.deepStrictEqual(
        this.room.peers.get(clientId)?.presence,
        wireCopy(peer.expected)
      );
    }
  }
}

const kMember = fc.nat({ max: kMembers - 1 });
const kAction: fc.Arbitrary<PresenceAction> = fc.oneof(
  {
    weight: 2,
    arbitrary: fc.record({
      type: fc.constant("join" as const),
      member: kMember
    })
  },
  {
    weight: 3,
    arbitrary: fc.record({
      type: fc.constant("patch" as const),
      member: kMember,
      patch: metadata
    })
  },
  {
    weight: 1,
    arbitrary: fc.record({
      type: fc.constant("leave" as const),
      member: kMember
    })
  }
);

describe("presence properties", () => {
  test("every member and a late joiner see each peer's patches merged in order", async() => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(kAction, { maxLength: 20 }),
        async(actions) => {
          const server = new Server();
          server.register(new RecordingExtension(kRoom));
          const transport = new LoopbackTransport({ server });
          const members = Array.from(
            { length: kMembers },
            () => new PresenceMember(transport)
          );

          try {
            for (const action of actions) {
              members[action.member].apply(action);
              await setImmediate();
            }

            const observer = new PresenceMember(transport);
            members.push(observer);
            observer.apply({ type: "join", member: 0 });
            await setImmediate();

            const joined = members.filter((member) => member.state === "joined");
            for (const member of joined) {
              member.assertSees(joined);
            }
          }
          finally {
            for (const member of members) {
              member.client.destroy();
            }
            await server.close();
          }
        }
      ),
      { numRuns: kRuns }
    );
  });
});
