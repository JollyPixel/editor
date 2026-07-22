# NetworkPlugin

Abstract base class for a server-side feature registered under one namespace on a [`NetworkServer`](./NetworkServer.md) (e.g. `PixelSyncServer` from `@jolly-pixel/pixel-draw.renderer`).

## Types

```ts
abstract class NetworkPlugin {
  abstract readonly namespace: string;

  abstract onClientConnect(client: ClientHandle): void;
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

The namespace this plugin handles. `NetworkServer` keys registered plugins by this value — two instances can't share a namespace.

## Methods

### `attach`

```ts
attach?(broadcast: (payload: unknown) => void): void
```

Optional. Called once by `NetworkServer.register()`, before any client connects. `broadcast` sends a payload to every client currently joined to this plugin's namespace — the plugin doesn't need to track membership itself.

---

### `onClientConnect` / `onClientDisconnect`

```ts
onClientConnect(client: ClientHandle): void
onClientDisconnect(clientId: string): void
```

Called by `NetworkServer` when a client joins/leaves this namespace. `client` is a scoped [`ClientHandle`](./NetworkServer.md#types): its `send()` auto-tags messages with this plugin's namespace, so the plugin never constructs a `NetworkEnvelope` itself.

---

### `onMessage`

```ts
onMessage(clientId: string, payload: unknown): void
```

Called for every `"message"` a joined client sends on this namespace. `payload` is whatever the client's `channel.send()` sent, envelope-free.

## Example

```ts
import { NetworkPlugin, type ClientHandle } from "@jolly-pixel/network";

class EchoPlugin extends NetworkPlugin {
  readonly namespace = "echo";

  onClientConnect(client: ClientHandle) {}
  onClientDisconnect(clientId: string) {}
  onMessage(clientId: string, payload: unknown) {
    // broadcast or reply
  }
}
```
