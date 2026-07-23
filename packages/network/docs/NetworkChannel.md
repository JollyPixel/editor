# NetworkChannel

Client-side handle to one namespace, obtained via [`NetworkClient.channel()`](./NetworkClient.md). Never constructed directly.

## Types

```ts
type NetworkChannelMessageListener<ServerPayload = unknown> = (
  payload: ServerPayload
) => void;

type NetworkChannelPeerListener = (
  clientId: string
) => void;

interface NetworkChannel<ClientPayload = unknown, ServerPayload = unknown> {
  readonly namespace: string;
  readonly localClientId: string;

  send(payload: ClientPayload): void;
  leave(): void;

  onMessage: NetworkChannelMessageListener<ServerPayload> | null;
  onPeerJoined: NetworkChannelPeerListener | null;
  onPeerLeft: NetworkChannelPeerListener | null;
}
```

## Properties

### `namespace`

```ts
readonly namespace: string
```

The namespace this channel is joined to.

### `localClientId`

```ts
readonly localClientId: string
```

Identifies the local peer, copied from the owning [`NetworkClient.clientId`](./NetworkClient.md#clientid). The same value across every channel a given client opens.

## Methods

### `send`

```ts
send(payload: ClientPayload): void
```

Sends `payload` to the matching [`NetworkPlugin`](./NetworkPlugin.md)'s `onMessage` on the server, envelope-free.

---

### `leave`

```ts
leave(): void
```

Leaves the namespace and removes the channel from `NetworkClient`'s internal map. A later `client.channel(namespace)` call creates a fresh one and re-joins.

## Properties (listeners)

### `onMessage`

```ts
onMessage: NetworkChannelMessageListener<ServerPayload> | null
```

Called for every message the server broadcasts/sends on this namespace.

### `onPeerJoined` / `onPeerLeft`

```ts
onPeerJoined: NetworkChannelPeerListener | null
onPeerLeft: NetworkChannelPeerListener | null
```

Called when another client joins/leaves this namespace. Never fires for the local client's own join; `onPeerLeft` also fires on a peer's disconnect, not just an explicit `leave()`.
