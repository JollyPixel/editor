# Client

Browser/Node counterpart to [`Server`](./Server.md). Owns one socket connection and provides room-scoped [`Room`](./Room.md) instances. Extends `@openally/emitt`'s `Emitter<{ ready: () => void }>`.

```ts
new Client(options: ClientOptions)

interface ClientOptions {
  /**
  * @default `${wss|ws}://${location.host}/ws-sync`
   */
  url?: string;
  /**
  * Static metadata attached to every join.
   */
  identity?: PeerMetadata;
  /**
   * @default a LogLayer instance backed by loglayer's `ConsoleTransport`
   */
  logger?: Logger;
}
```

When `url` is omitted, it is derived from browser `location` using `/ws-sync`.

## Properties

### `id`

```ts
readonly id: string
```

Stable id for this client connection, reused across all opened rooms.

### `ready`

```ts
readonly ready: boolean
```

Whether the underlying socket has finished opening.

## Events

### `"ready"`

Fired once when the socket opens.

```ts
client.on("ready", () => {
  console.log("connected");
});
```

## Methods

### `room`

```ts
room<ClientMessage = unknown, ServerMessage = unknown>(
  name: string
): Room<ClientMessage, ServerMessage>
```

Returns the room handle for `name`. Call [`room.join()`](./Room.md#join) when you're ready to actually join it.

- Repeated calls with the same room name return the same room instance.

### `destroy`

```ts
destroy(): void
```

Closes the underlying socket.

## Behavior

- Incoming malformed/unroutable messages are dropped and logged.
- Outgoing serialization failures are logged and dropped.
- Messages sent before the connection opens are queued and flushed when ready.

`Logger` is `loglayer`'s `ILogLayer` type; defaults to a `LogLayer` wrapping loglayer's own `ConsoleTransport` if `logger` is not provided. Being on `loglayer` (not a hand-rolled interface) means the same `Logger` type — and the same `.withMetadata()/.withError()` structured-logging API — is shared with the server side ([`Server`](./Server.md), [`ServerRoom`](./ServerRoom.md)).

## Quick Use

- Create one `Client` per connection.
- Use `client.room(name)` to get a typed room handle.
- Call `client.destroy()` when done.

```ts
import * as network from "@jolly-pixel/network";

const client = new network.Client({
  identity: {
    username: "alice"
  }
});

const room = client.room("echo");

room.on("message", (payload) => console.log(payload));
room.on("peer-joined", (event) => console.log(`${event.clientId} joined`));
room.on("peer-left", (event) => console.log(`${event.clientId} left`));

room.join();
room.send({ hello: "world" });
```
