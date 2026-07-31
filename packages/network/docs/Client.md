# Client

Browser/Node side of the wire. Owns one socket and hands out room-scoped `Room` handles.

```ts
import * as network from "@jolly-pixel/network";

const client = new network.Client({
  identity: { username: "alice" }
});

const room = client.room("echo");

room.on("message", (payload) => console.log(payload));
room.join();
room.send({ hello: "world" });
```

## Client

```ts
new Client(options?: ClientOptions)

interface ClientOptions {
  /**
   * @default `${wss|ws}://${location.host}/ws-sync`
   */
  url?: string;
  /**
   * Static metadata attached to every join.
   */
  identity?: PeerMetadata;
  logger?: Logger;
}
```

- `id` — stable connection id, reused across every room.
- `ready` — whether the socket finished opening. The `"ready"` event fires once at that point.
- `room(name)` — returns the handle for `name`; the same name always returns the same instance. It does not join.
- `destroy()` — closes the socket.

`identity.role` feeds the server's rights table when one is configured — see [Rights](./Rights.md).

## Room

Obtained from `client.room()`, never constructed directly.

```ts
interface Room<ClientMessage = unknown, ServerMessage = unknown> {
  readonly id: string;
  readonly clientId: string;
  readonly peers: ReadonlyMap<string, Peer>;

  join(): void;
  send(payload: ClientMessage): void;
  updatePresence(patch: PeerMetadata): void;
  leave(): void;

  on<K extends keyof RoomEventMap<ServerMessage>>(
    type: K,
    listener: RoomEventMap<ServerMessage>[K]
  ): void;
  off<K extends keyof RoomEventMap<ServerMessage>>(
    type: K,
    listener: RoomEventMap<ServerMessage>[K]
  ): void;
}

interface Peer {
  readonly clientId: string;
  readonly identity: PeerMetadata;
  readonly presence: PeerMetadata;
}
```

- `join()` — joins on the server, carrying the client's identity. No-op once joined.
- `send(payload)` — sends a room-scoped message; the payload passes through untouched.
- `updatePresence(patch)` — per-room dynamic metadata (cursor position, ...), shallow-merged server-side and relayed to peers as `"peer-presence"`.
- `leave()` — leaves, clears the local peer cache, drops the room from the client.
- `peers` — remote peers only, never the local client. Seeded on join, then kept current by the peer events.

## Events

Any number of listeners per event; `off` removes only the listener passed in. Listeners receive the payload directly.

| Event | Payload | Fired when |
|---|---|---|
| `message` | `ServerMessage` | the room's extension sends to this client |
| `peer-joined` | `{ clientId }` | a remote peer joins after you |
| `peer-left` | `{ clientId }` | a remote peer leaves or disconnects |
| `peer-presence` | `{ clientId, patch }` | a remote presence patch arrives — `peers` is already updated |
| `denied` | `{ event, reason }` | the server refused one of your own actions on rights grounds |
| `error` | `{ event, reason }` | server-side extension flow failed (persistence, infrastructure) |

`denied` and `error` share a shape but not a meaning: `denied` means you aren't allowed, `error` means it broke.
