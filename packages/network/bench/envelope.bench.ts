// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  ROOM_NAME,
  cursorPatch,
  snapshotOf,
  strokeCommand
} from "./_fixtures.ts";
import { Envelope } from "../src/protocol/envelope/Envelope.ts";

// CONSTANTS
const kSnapshotBytes = 256 * 1024;

const suite = defineSuite("network / Envelope", (bench) => {
  const command = JSON.stringify({
    room: ROOM_NAME,
    kind: "message",
    payload: strokeCommand(0)
  });
  const presence = JSON.stringify({
    room: ROOM_NAME,
    kind: "presence",
    patch: cursorPatch(1)
  });
  const broadcast = JSON.stringify({
    room: ROOM_NAME,
    kind: "message",
    payload: {
      type: "command",
      data: strokeCommand(0),
      version: 1
    }
  });
  const snapshot = JSON.stringify({
    room: ROOM_NAME,
    kind: "message",
    payload: {
      type: "snapshot",
      data: snapshotOf(kSnapshotBytes),
      version: 1
    }
  });

  const sink: unknown[] = [];
  bench
    .add("parseClient command", () => {
      sink[0] = Envelope.parseClient(command);
    })
    .add("JSON.parse command (floor)", () => {
      sink[0] = JSON.parse(command);
    })
    .add("parseClient presence", () => {
      sink[0] = Envelope.parseClient(presence);
    })
    .add("parseServer command", () => {
      sink[0] = Envelope.parseServer(broadcast);
    })
    .add("parseTrustedServer command", () => {
      sink[0] = Envelope.parseTrustedServer(broadcast);
    })
    .add("parseServer 256 KB snapshot", () => {
      sink[0] = Envelope.parseServer(snapshot);
    })
    .add("parseTrustedServer 256 KB snapshot", () => {
      sink[0] = Envelope.parseTrustedServer(snapshot);
    })
    .add("JSON.parse 256 KB snapshot (floor)", () => {
      sink[0] = JSON.parse(snapshot);
    });

  return () => {
    sink.length = 0;
  };
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
