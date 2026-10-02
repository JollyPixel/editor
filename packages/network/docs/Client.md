# Client

Browser/Node side of the wire. Owns one socket and hands out room-scoped `Room` handles.

```ts
import * as network from "@jolly-pixel/network";

const client = new network.Client({
  profile: { username: "alice" },
  socket: () => network.connectWebSocket({ credential: password })
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
   * Untrusted, presentational metadata attached to every join.
   */
  profile?: PeerMetadata;
  logger?: Logger;
  /**
   * Opens the connection.
   * @default () => connectWebSocket()
   */
  socket?: () => ClientSocket;
  /**
   * Reopens the connection after an unexpected close; false disables it.
   * @default true
   */
  reconnect?: boolean | ClientReconnectOptions;
}

interface ClientReconnectOptions {
  /**
   * Milliseconds before each attempt; the last one repeats.
   * @default [500, 1000, 2000, 5000, 10000]
   */
  delays?: readonly number[];
}

function connectWebSocket(options?: WebSocketConnectOptions): ClientSocket;

interface WebSocketConnectOptions {
  /**
   * @default `${wss|ws}://${location.host}/ws-sync`
   */
  url?: string;
  /**
   * Opaque credential offered during the handshake.
   */
  credential?: string;
}

interface ClientSocket {
  send(data: string): void;
  close(): void;
  addEventListener(
    type: "open" | "message" | "error" | "close",
    listener: (event: ClientSocketEvent) => void
  ): void;
}

interface ClientSocketEvent {
  readonly data?: unknown;
  readonly code?: number;
  readonly reason?: string;
}
```

- `ready` — whether the socket is open. The `"ready"` event fires each time it opens, after the messages queued meanwhile are flushed.
- `room(name, options?)` — returns the handle for `name`; the same name returns the same instance until that handle leaves, and only the first call's options apply. It does not join.
- `destroy()` — closes the socket and cancels a pending reconnect. Messages sent once the socket is closing or closed are dropped with a warning.

## Reconnecting

After an unexpected close, the client waits for the next delay and calls `socket` again, until a socket opens or `destroy()` runs. A close with the `unauthorized` code stops it, as does `reconnect: false`. A factory that throws counts as a failed attempt.

When an open socket drops, the client emits `"disconnected"` and every joined room is suspended: `clientId` becomes `null`, `peers` empties with a `"peer-left"` per peer, and the room stays joined. Envelopes sent during the gap are queued. When the next socket opens, every joined room sends `join` again, with its resume payload, before the queue is flushed; the server answers with a new `sync`.

`connectWebSocket()` opens the default `WebSocket` connection; pass it through `socket` to change the url or offer a credential. Any other `ClientSocket` works too, such as a server living in the same process: see [LoopbackTransport](./Transports.md#loopbacktransport).

`profile` is untrusted: the server never reads a role or a user id from it. The connection's role comes from [authentication](./Authentication.md), and `credential` is what the server's provider inspects to decide it.

## Room

Obtained from `client.room()`, never constructed directly.

```ts
interface Room<TClientMessage = unknown, TServerMessage = unknown> {
  readonly id: string;
  readonly clientId: string | null;
  readonly peers: ReadonlyMap<string, Peer>;

  join(): void;
  send(payload: TClientMessage): void;
  updatePresence(patch: PeerMetadata): void;
  resync(): void;
  resumeWith(source: (() => unknown) | null): void;
  leave(): void;

  on<K extends keyof RoomEventMap<TServerMessage>>(
    type: K,
    listener: RoomEventMap<TServerMessage>[K]
  ): void;
  off<K extends keyof RoomEventMap<TServerMessage>>(
    type: K,
    listener: RoomEventMap<TServerMessage>[K]
  ): void;
}

interface Peer {
  readonly clientId: string;
  readonly role: string;
  readonly profile: PeerMetadata;
  readonly presence: PeerMetadata;
}

interface RoomOptions<TServerMessage = unknown> {
  parser?: RoomMessageParser<TServerMessage>;
}
```

- `join()` — joins on the server, carrying the client's profile and the presence set so far. No-op once joined; throws once the handle has left.
- `send(payload)` — sends a room-scoped message; the payload passes through untouched.
- `updatePresence(patch)` — per-room dynamic metadata (cursor position, ...), shallow-merged server-side and relayed to peers as `"peer-presence"`. Before `join()` it is only merged locally and sent with the join, so it never needs re-publishing on `"sync"`. Clear a field with `null`: `undefined` is dropped by JSON.
- `resync()` — asks the extension for a fresh state; the server calls its `onResync`. No-op until joined. [`CommandSync`](./sync/CommandSync.md) calls it when it cannot rebase its pending commands.
- `resumeWith(source)` — `source()` is called for every `join` and its result sent as `resume` unless it is `undefined`; the extension reads it as `RoomPeer.resume`. `CommandSync` installs one. Pass `null` to remove it.
- `leave()` — sends the leave if joined, clears the peers, `clientId`, `role` and `rights`, emits `"left"` and drops the handle from the client. The handle is spent: `client.room(name)` returns a new one. Calling it again is a no-op.
- `peers` — remote peers only, never the local client. Replaced by each `sync`, then kept current by the peer events. A presence patch replaces the `Peer` object rather than mutating it.
- `clientId` — the id peers see, learned from the server on join. `null` until then and after `leave()`.
- `role`, `rights`, `can(event)`, `access` — this connection's own access, resolved server-side and delivered with the join snapshot. See [Rights](./Rights.md#reading-rights-on-the-client).

## Events

Any number of listeners per event; `off` removes only the listener passed in. Listeners receive the payload directly.

| Event | Payload | Fired when |
|---|---|---|
| `message` | `ServerMessage` | the room's extension sends to this client |
| `sync` | `{ self, clientIds }` | your join was admitted — `clientId`, `role`, `rights` and `peers` are now current. `clientIds` lists remote peers only |
| `peer-joined` | `{ clientId }` | a remote peer joins after you; `peers` already holds its profile and join presence |
| `peer-left` | `{ clientId }` | a remote peer leaves or disconnects |
| `peer-presence` | `{ clientId, patch }` | a remote presence patch arrives — `peers` is already updated |
| `denied` | `{ event, reason }` | the server refused one of your own actions on rights grounds |
| `error` | `{ event, reason }` | server-side extension flow failed (persistence, infrastructure), or the room refused your payload |
| `malformed` | `{ payload, errors }` | an inbound payload failed this room's parser (only with `options.parser`) |
| `left` | none | this handle called `leave()`; `peers` is already empty |

`denied` and `error` share the `RoomRejectionEvent` shape but not a meaning: `denied` means you aren't allowed, `error` means it broke.

The client itself emits `"ready"` when a socket opens, `"disconnected"` when an open socket drops, and `"unauthorized"` when the server refused the handshake — see [Authentication](./Authentication.md#rejection).

## Parsing inbound payloads

By default `message` hands you the payload the server sent, untouched and typed only by the `ServerMessage` parameter. Pass a parser to have the room check it instead:

```ts
import { MessageParser } from "@jolly-pixel/network";

const room = client.room("voxel-map", {
  parser: new MessageParser(voxelServerMessages)
});

room.on("message", (message) => applyCommand(message));
room.on("malformed", ({ payload, errors }) => logger.warn({ payload, errors }));
```

A payload that matches emits `message`; one that doesn't emits `malformed` and never reaches the `message` listeners.

`options.parser` accepts anything shaped like `RoomMessageParser`, so you can supply a validator compiled ahead of time instead. `MessageParser` compiles schemas at runtime and lives behind its own subpath for that reason: importing it adds a JSON Schema compiler to a browser bundle, and a client that never passes a parser never pays for one.

`MessageParser.of(protocol)` returns one parser per protocol object and compiles it once. The server parses every room through it, so rooms built from the same `MessageProtocols` share their validators.
