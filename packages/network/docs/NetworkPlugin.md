# NetworkPlugin

Abstract base class for namespace handlers registered on [`NetworkServer`](./NetworkServer.md).

```ts
abstract class NetworkPlugin {
  abstract readonly namespace: string;

  abstract onClientConnect(client: ClientHandle, identity: PeerMetadata): void;
  abstract onClientDisconnect(clientId: string): void;
  abstract onMessage(clientId: string, payload: unknown): void;

  attach?(broadcast: (payload: unknown) => void): void;
}
```

## Properties

### `namespace`

```ts
abstract readonly namespace: string
```

Namespace key handled by this plugin. Must be unique in one `NetworkServer`.

## Lifecycle Methods

### `attach`

```ts
attach?(broadcast: (payload: unknown) => void): void
```

Optional one-time hook called during `server.register(plugin)`.

- `broadcast(payload)` sends a namespace-scoped message to all joined members.
- Useful for timers, server-driven events, or startup state pushes.

### `onClientConnect`

```ts
onClientConnect(client: ClientHandle, identity: PeerMetadata): void
```

Called when a client joins this namespace.

- `client.send(data)` sends a namespace-scoped `"message"` envelope.
- `identity` comes from `NetworkClientOptions.identity`.

### `onClientDisconnect`

```ts
onClientDisconnect(clientId: string): void
```

Called when a previously joined client leaves/disconnects this namespace.

### `onMessage`

```ts
onMessage(clientId: string, payload: unknown): void
```

Called for every `"message"` sent by joined clients on this namespace.

## Example

```ts
import {
  NetworkPlugin,
  type ClientHandle
} from "@jolly-pixel/network";

class EchoPlugin extends NetworkPlugin {
  readonly namespace = "echo";

  onClientConnect(client: ClientHandle) {
    client.send({ type: "ready" });
  }

  onClientDisconnect(clientId: string) {
    clientId;
  }

  onMessage(clientId: string, payload: unknown) {
    clientId;
    payload;
  }
}
```
