# NetworkChannel

Client-side handle to one namespace, obtained via [`NetworkClient.channel()`](./NetworkClient.md#channel). Do not construct directly.

```ts
type NetworkChannelMessageListener<ServerPayload = unknown> = (
  payload: ServerPayload
) => void;

type NetworkChannelPeerListener = (clientId: string) => void;

type NetworkChannelPeerMetadataListener = (
  clientId: string,
  patch: PeerMetadata
) => void;

interface NetworkPeer {
  readonly clientId: string;
  readonly identity: PeerMetadata;
  readonly presence: PeerMetadata;
}

interface NetworkChannel<ClientPayload = unknown, ServerPayload = unknown> {
  readonly namespace: string;
  readonly localClientId: string;
  readonly peers: ReadonlyMap<string, NetworkPeer>;

  send(payload: ClientPayload): void;
  updatePresence(patch: PeerMetadata): void;
  leave(): void;

  onMessage: NetworkChannelMessageListener<ServerPayload> | null;
  onPeerJoined: NetworkChannelPeerListener | null;
  onPeerLeft: NetworkChannelPeerListener | null;
  onPeerPresence: NetworkChannelPeerMetadataListener | null;
}
```

## Properties

### `namespace`

```ts
readonly namespace: string
```

Namespace this channel is joined to.

### `localClientId`

```ts
readonly localClientId: string
```

Local client id, mirrored from [`NetworkClient.clientId`](./NetworkClient.md#clientid).

### `peers`

```ts
readonly peers: ReadonlyMap<string, NetworkPeer>
```

Current remote peers in this namespace (never includes local client), keyed by `clientId`.

- Initial state is populated from `"sync"`.
- Incremental updates come from `"peer-joined"`, `"peer-left"`, and `"peer-presence"`.

## Methods

### `send`

```ts
send(payload: ClientPayload): void
```

Sends a namespace `"message"` envelope to the server plugin. The payload is passed through as-is.

### `updatePresence`

```ts
updatePresence(patch: PeerMetadata): void
```

Sends a namespace `"presence"` patch. Server-side state is shallow-merged and relayed to other peers as `"peer-presence"`.

### `leave`

```ts
leave(): void
```

Sends `"leave"`, clears local peer cache, and removes the channel from the client's channel map.

## Listener Properties

### `onMessage`

```ts
onMessage: NetworkChannelMessageListener<ServerPayload> | null
```

Fires for `"message"` events from this namespace.

### `onPeerJoined`

```ts
onPeerJoined: NetworkChannelPeerListener | null
```

Fires when a remote peer joins after you are already joined.

### `onPeerLeft`

```ts
onPeerLeft: NetworkChannelPeerListener | null
```

Fires when a remote peer leaves or disconnects.

### `onPeerPresence`

```ts
onPeerPresence: NetworkChannelPeerMetadataListener | null
```

Fires when a remote presence patch arrives. `peers` is already updated before callback execution.
