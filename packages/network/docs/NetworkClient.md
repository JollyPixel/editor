# NetworkClient

Browser/Node counterpart to [`NetworkServer`](./NetworkServer.md). Owns one socket connection and provides namespace-scoped [`NetworkChannel`](./NetworkChannel.md) instances.

```ts
new NetworkClient(options: NetworkClientOptions)

interface NetworkClientOptions {
  url: string;
  /**
   * Connection-wide static metadata, attached to every join.
   * Example: { username: "alice" }
   */
  identity?: PeerMetadata;
}
```

## Properties

### `clientId`

```ts
readonly clientId: string
```

Stable id for this client connection (`crypto.randomUUID()`), reused across all opened channels.

## Methods

### `channel`

```ts
channel<ClientPayload = unknown, ServerPayload = unknown>(
  namespace: string
): NetworkChannel<ClientPayload, ServerPayload>
```

Returns the channel for `namespace`.

- First call creates channel and sends `"join"` with client `identity`.
- Repeated calls for same namespace return the same channel instance.
- Outbound messages queue until the socket `open` event, then flush.

### `destroy`

```ts
destroy(): void
```

Closes the underlying WebSocket.

## Usage Notes

- `identity` is fixed for the connection lifetime. Reconnect to change it.
- Use [`NetworkChannel.updatePresence()`](./NetworkChannel.md#updatepresence) for frequently changing per-namespace metadata.
- Incoming envelopes for unknown/unopened namespaces are ignored.

## Example

```ts
import { NetworkClient } from "@jolly-pixel/network";

const client = new NetworkClient({
  url: "ws://localhost:5173/ws-sync",
  identity: {
    username: "alice"
  }
});

const channel = client.channel("echo");

channel.onMessage = (payload) => console.log(payload);
channel.onPeerJoined = (peerId) => console.log(`${peerId} joined`);
channel.onPeerLeft = (peerId) => console.log(`${peerId} left`);

channel.send({ hello: "world" });
```
