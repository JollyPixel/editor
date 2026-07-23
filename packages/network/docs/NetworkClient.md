# NetworkClient

Browser/Node counterpart to [`NetworkServer`](./NetworkServer.md). Relies on the global `WebSocket` (available in both environments). Owns one connection and hands out namespace-scoped [`NetworkChannel`](./NetworkChannel.md)s.

## Types

```ts
new NetworkClient(options: NetworkClientOptions)

interface NetworkClientOptions {
  url: string;
}
```

## Properties

### `clientId`

```ts
readonly clientId: string
```

Identifies this client across every channel it joins. Generated once per connection (`crypto.randomUUID()`), so consumers don't each need to invent their own peer id. Mirrored onto every `NetworkChannel` this client creates as `channel.localClientId`.

## Methods

### `channel`

```ts
channel<ClientPayload = unknown, ServerPayload = unknown>(
  namespace: string
): NetworkChannel<ClientPayload, ServerPayload>
```

Returns the `NetworkChannel` for `namespace`, creating and joining it (sends a `"join"` envelope) on first call. Subsequent calls with the same namespace return the same instance.

Messages sent (via `channel.send()`) before the socket finishes opening are queued and flushed once it does.

---

### `destroy`

```ts
destroy(): void
```

Closes the underlying `WebSocket`.

## Example

```ts
import { NetworkClient } from "@jolly-pixel/network";

const client = new NetworkClient({ url: "ws://localhost:5173/ws-sync" });
const channel = client.channel("echo");

channel.onMessage = (payload) => console.log(payload);
channel.onPeerJoined = (clientId) => console.log(`${clientId} joined`);
channel.onPeerLeft = (clientId) => console.log(`${clientId} left`);
channel.send({ hello: "world" });
```
