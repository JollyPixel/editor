// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import { Envelope } from "#src/protocol/envelope/Envelope.ts";
import type { RoomEventMap } from "#src/index.ts";
import { createOpenClient } from "../helpers/client/FakeSocket.ts";
import { captureLogger } from "../helpers/captureLogger.ts";
import { serverEnvelope } from "../helpers/arbitraries/envelopes.ts";

// CONSTANTS
const kRoom = "room";
const kRoomEvents: (keyof RoomEventMap)[] = [
  "message",
  "sync",
  "peer-joined",
  "peer-left",
  "peer-presence",
  "denied",
  "error",
  "malformed",
  "left"
];

const kIgnoredFrame = fc.oneof(
  fc.oneof(fc.string(), fc.json())
    .filter((raw) => !Envelope.parseServer(raw).ok),
  serverEnvelope
    .filter((envelope) => envelope.room !== kRoom)
    .map((envelope) => JSON.stringify(envelope))
);

describe("Client properties", () => {
  test("a rejected frame or one for an unjoined room leaves the joined room untouched", () => {
    fc.assert(
      fc.property(
        fc.array(kIgnoredFrame, { maxLength: 8 }),
        (frames) => {
          const { logger, errors } = captureLogger();
          const { client, socket } = createOpenClient({ logger });
          const room = client.room(kRoom);
          room.join();
          socket.receive({
            room: kRoom,
            kind: "sync",
            self: "me",
            rights: {},
            members: [
              { clientId: "me", role: "default", profile: {}, presence: {} },
              { clientId: "peer", role: "default", profile: {}, presence: { x: 1 } }
            ]
          });
          const peers = structuredClone([...room.peers]);
          const fired: string[] = [];
          for (const event of kRoomEvents) {
            room.on(event, () => fired.push(event));
          }

          for (const frame of frames) {
            socket.deliver(frame);
          }

          assert.deepStrictEqual([...room.peers], peers);
          assert.deepStrictEqual(fired, []);
          assert.deepStrictEqual(errors, []);

          socket.receive({ room: kRoom, kind: "peer-left", clientId: "peer" });
          assert.deepStrictEqual(fired, ["peer-left"]);
          assert.strictEqual(room.peers.size, 0);
          client.destroy();
        }
      )
    );
  });
});
