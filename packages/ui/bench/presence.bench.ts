// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";
import type {
  Peer,
  Room
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { RoomPresenceSource } from "../src/network/RoomPresenceSource.ts";
import { resolveLock } from "../src/peer/resolveLock.ts";

// CONSTANTS
const kPeerCount = 8;
const kFieldCount = 40;

const suite = defineSuite("presence", (bench) => {
  const peers = new Map<string, Peer>();
  for (let index = 0; index < kPeerCount; index++) {
    peers.set(`transport-${index}`, {
      clientId: `transport-${index}`,
      role: "default",
      profile: {
        username: `Peer ${index}`,
        peerId: `peer-${index}`
      },
      presence: {
        fieldLock: index % 2 === 0 ? `field-${index}` : null
      }
    });
  }
  const room = {
    clientId: "me",
    profile: {
      username: "Me",
      peerId: "me"
    },
    peers,
    updatePresence: () => void 0,
    on: () => void 0,
    off: () => void 0
  } as unknown as Room;
  const source = new RoomPresenceSource(room);
  const paths = Array.from(
    { length: kFieldCount },
    (_, index) => `field-${index}`
  );

  bench
    .add("peers read", () => source.peers.size)
    .add("lock refresh, every field", () => {
      let held = 0;
      for (const path of paths) {
        held += resolveLock(
          source.peers.values(),
          path,
          source.clientId
        ).peers.length;
      }

      return held;
    });
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
