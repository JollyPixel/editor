# NetworkServer

Transport-agnostic multiplexer sitting between raw connections and registered [`NetworkPlugin`](./NetworkPlugin.md) instances. Carries no knowledge of WebSocket/WebRTC/etc. — a transport (e.g. [`WebsocketTransport`](./transport/websocket.md)) drives it via `handleConnect`/`handleDisconnect`/`handleMessage`. See [ARCHITECTURE.md](../ARCHITECTURE.md) for the wire format and connection lifecycle.

## Types

```ts
interface ClientHandle {
  readonly id: string;
  send(data: unknown): void;
}
```

A connection abstraction handed to `NetworkServer` by a transport, and scoped by `NetworkServer` before being handed to a `NetworkPlugin` (so its `send()` auto-tags messages with that plugin's namespace). Consumers never construct one directly.

## Methods

### `register`

```ts
register(plugin: NetworkPlugin): void
```

Registers `plugin` under its `namespace` and calls its `attach()` hook (if defined) with a broadcast function scoped to that namespace.

---

### `handleConnect`

```ts
handleConnect(client: ClientHandle): void
```

Records a newly connected client. Called by the transport, once per connection.

---

### `handleDisconnect`

```ts
handleDisconnect(clientId: string): void
```

Removes the client from every namespace it had joined — each joined plugin's `onClientDisconnect` fires and remaining namespace members receive `"peer-left"` — then forgets the client entirely.

---

### `handleMessage`

```ts
handleMessage(clientId: string, raw: unknown): void
```

Entry point for data arriving from a client. Silently drops anything that isn't a valid `NetworkEnvelope` (see [ARCHITECTURE.md](../ARCHITECTURE.md#wire-format)) or targets an unregistered namespace. Otherwise:
- `"join"`: adds the client to the namespace's members, broadcasts `"peer-joined"` to the other members (never to the joining client itself), then calls the plugin's `onClientConnect`.
- `"leave"`: broadcasts `"peer-left"`, calls the plugin's `onClientDisconnect`, and removes the client from the namespace.
- `"message"`: forwarded to the plugin's `onMessage`, only if the client has joined that namespace.

## Example

```ts
import { NetworkServer, NetworkPlugin } from "@jolly-pixel/network";

const server = new NetworkServer();
server.register(new EchoPlugin());
```
