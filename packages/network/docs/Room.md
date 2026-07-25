# Room

Client-side handle to one room, obtained via [`Client.room()`](./Client.md#room). Do not construct directly.

```ts
type RoomMessageListener<ServerMessage = unknown> = (
  payload: ServerMessage
) => void;

type RoomPeerListener = (clientId: string) => void;

type RoomPeerMetadataListener = (
  clientId: string,
  patch: PeerMetadata
) => void;

interface Peer {
  readonly clientId: string;
  readonly identity: PeerMetadata;
  readonly presence: PeerMetadata;
}

interface Room<ClientMessage = unknown, ServerMessage = unknown> {
  readonly id: string;
  readonly clientId: string;
  readonly peers: ReadonlyMap<string, Peer>;

  send(payload: ClientMessage): void;
  updatePresence(patch: PeerMetadata): void;
  leave(): void;

  onMessage: RoomMessageListener<ServerMessage> | null;
  onPeerJoined: RoomPeerListener | null;
  onPeerLeft: RoomPeerListener | null;
  onPeerPresence: RoomPeerMetadataListener | null;
}
```

## Properties

### `id`

```ts
readonly id: string
```

Name of the room this handle is joined to.

### `clientId`

```ts
readonly clientId: string
```

Local client id, mirrored from [`Client.id`](./Client.md#id).

### `peers`

```ts
readonly peers: ReadonlyMap<string, Peer>
```

Current remote peers in this room (never includes local client), keyed by `clientId`.

- Initial state is populated from `"sync"`.
- Incremental updates come from `"peer-joined"`, `"peer-left"`, and `"peer-presence"`.

## Methods

### `send`

```ts
send(payload: ClientMessage): void
```

Sends a room-scoped `"message"` envelope to the server authority. The payload is passed through as-is.

### `updatePresence`

```ts
updatePresence(patch: PeerMetadata): void
```

Sends a room-scoped `"presence"` patch. Server-side state is shallow-merged and relayed to other peers as `"peer-presence"`.

### `leave`

```ts
leave(): void
```

Sends `"leave"`, clears local peer cache, and removes the room from the client's room map.

## Listener Properties

### `onMessage`

```ts
onMessage: RoomMessageListener<ServerMessage> | null
```

Fires for `"message"` events from this room.

### `onPeerJoined`

```ts
onPeerJoined: RoomPeerListener | null
```

Fires when a remote peer joins after you are already joined.

### `onPeerLeft`

```ts
onPeerLeft: RoomPeerListener | null
```

Fires when a remote peer leaves or disconnects.

### `onPeerPresence`

```ts
onPeerPresence: RoomPeerMetadataListener | null
```

Fires when a remote presence patch arrives. `peers` is already updated before callback execution.
