// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  ROOM_NAME,
  benchProtocols,
  cursorPatch,
  silentLogger,
  strokeCommand,
  type BenchCommand,
  type BenchSnapshot
} from "./_fixtures.ts";
import {
  Client,
  CommandSync,
  type ClientSocket,
  type ClientSocketEvent,
  type ClientSocketEventType,
  type NetworkServerMessage
} from "../src/index.ts";
import { MessageParser } from "../src/protocol/message/MessageParser.ts";

// CONSTANTS
const kPeers = 10;
const kVariants = 20;
const kSelf = "self";

type Listener = (event: ClientSocketEvent) => void;

class BenchSocket implements ClientSocket {
  sent = 0;
  #listeners = new Map<ClientSocketEventType, Listener[]>();

  addEventListener(
    type: ClientSocketEventType,
    listener: Listener
  ): void {
    const listeners = this.#listeners.get(type) ?? [];
    listeners.push(listener);
    this.#listeners.set(type, listeners);
  }

  send(): void {
    this.sent++;
  }

  close(): void {
    this.#emit("close", { code: 1000 });
  }

  open(): void {
    this.#emit("open", {});
  }

  deliver(
    data: string
  ): void {
    this.#emit("message", { data });
  }

  #emit(
    type: ClientSocketEventType,
    event: ClientSocketEvent
  ): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

const suite = defineSuite("network / Client receive", (bench) => {
  const socket = new BenchSocket();
  const client = new Client({
    socket: () => socket,
    logger: silentLogger(),
    reconnect: false
  });
  const { outbound } = benchProtocols(kVariants);
  const room = client.room<
    BenchCommand,
    NetworkServerMessage<BenchCommand, BenchSnapshot>
  >(ROOM_NAME, {
    parser: MessageParser.of(outbound)
  });
  const sync = new CommandSync<BenchCommand, BenchSnapshot>(room);
  let applied = 0;
  sync.on("command", () => {
    applied++;
  });

  socket.open();
  room.join();
  socket.deliver(JSON.stringify({
    room: ROOM_NAME,
    kind: "sync",
    self: kSelf,
    rights: {},
    members: Array.from({ length: kPeers + 1 }, (_, index) => {
      return {
        clientId: index === 0 ? kSelf : `peer-${index}`,
        role: "editor",
        profile: {},
        presence: {}
      };
    })
  }));
  socket.deliver(serverMessage({
    type: "snapshot",
    data: { pixels: "" },
    version: 0
  }));

  let version = 0;
  const peerCommands = Array.from({ length: 64 }, () => serverMessage({
    type: "command",
    data: strokeCommand(kVariants - 1, 1, "peer-1"),
    version: ++version
  }));
  const presence = Array.from({ length: 64 }, (_, step) => JSON.stringify({
    room: ROOM_NAME,
    kind: "peer-presence",
    clientId: "peer-1",
    patch: cursorPatch(step)
  }));
  let step = 0;
  const { action, color, xy } = strokeCommand(kVariants - 1);

  bench
    .add(`peer command [${kVariants} variants]`, () => {
      socket.deliver(peerCommands[step++ % peerCommands.length]);
    })
    .add(`peer presence [${kPeers} peers]`, () => {
      socket.deliver(presence[step++ % presence.length]);
    })
    .add("send then own echo", () => {
      const sent = sync.send({
        action,
        color,
        xy
      });
      socket.deliver(serverMessage({
        type: "command",
        data: sent,
        version: ++version
      }));
    });

  return () => {
    sync.destroy();
    client.destroy();
    if (applied === 0) {
      throw new Error("no command reached the document");
    }
  };
});

export default suite;

function serverMessage(
  payload: NetworkServerMessage<BenchCommand, BenchSnapshot>
): string {
  return JSON.stringify({
    room: ROOM_NAME,
    kind: "message",
    payload
  });
}

if (import.meta.main) {
  await runSuites([suite]);
}
