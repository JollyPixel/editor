# NetworkServer

Transport-agnostic multiplexer between raw connections and registered [`NetworkPlugin`](./NetworkPlugin.md) instances.

```ts
interface ClientHandle {
  readonly id: string;
  send(data: unknown): void;
}
```

## Methods

### `register`

```ts
register(plugin: NetworkPlugin): void
```

Registers plugin under `plugin.namespace`.

- Creates one internal [`NetworkServerNamespace`](./NetworkServerNamespace.md) per plugin.
- Calls `plugin.attach?.(broadcast)` with namespace-scoped broadcast function.

### `handleConnect`

```ts
handleConnect(client: ClientHandle): void
```

Tracks a newly connected client. Called by transport layer.

### `handleDisconnect`

```ts
handleDisconnect(clientId: string): void
```

Disconnect flow:

- Leaves all joined namespaces for that client.
- Triggers namespace `peer-left` broadcasts.
- Triggers plugin `onClientDisconnect` for each joined namespace.
- Removes client record.

### `handleMessage`

```ts
handleMessage(clientId: string, raw: unknown): void
```

Routes validated envelopes.

- Invalid envelopes are ignored.
- Unknown clients or namespaces are ignored.
- `"join"`: first join only, then `namespace.join(...)`.
- `"leave"`: only if joined, then `namespace.leave(...)`.
- `"message"`: forwarded only if joined.
- `"presence"`: forwarded only if joined.

## Envelope Effects

- `"join"` sends `"peer-joined"` to others, `"sync"` to joiner, then plugin `onClientConnect`.
- `"leave"` sends `"peer-left"` and plugin `onClientDisconnect`.
- `"message"` maps to plugin `onMessage`.
- `"presence"` shallow-merges and sends `"peer-presence"` to others.

## See Also

- [`transport/websocket`](./transport/websocket.md)
- `packages/network/ARCHITECTURE.md`
