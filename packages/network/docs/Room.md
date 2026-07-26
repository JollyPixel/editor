# Room

Client-side handle to one room, obtained via [`Client.room()`](./Client.md#room). Do not construct directly.

```ts
interface RoomPeerEventDetail {
  clientId: string;
}

interface RoomPeerPresenceEventDetail extends RoomPeerEventDetail {
  patch: PeerMetadata;
}

interface RoomEventMap<ServerMessage = unknown> {
  message: CustomEvent<ServerMessage>;
  "peer-joined": CustomEvent<RoomPeerEventDetail>;
  "peer-left": CustomEvent<RoomPeerEventDetail>;
  "peer-presence": CustomEvent<RoomPeerPresenceEventDetail>;
}

interface Peer {
  readonly clientId: string;
  readonly identity: PeerMetadata;
  readonly presence: PeerMetadata;
}

interface Room<ClientMessage = unknown, ServerMessage = unknown> {
  readonly id: string;
  readonly clientId: string;
  readonly peers: ReadonlyMap<string, Peer>;

  join(): void;
  send(payload: ClientMessage): void;
  updatePresence(patch: PeerMetadata): void;
  leave(): void;

  addEventListener<K extends keyof RoomEventMap<ServerMessage>>(
    type: K,
    listener: (event: RoomEventMap<ServerMessage>[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener<K extends keyof RoomEventMap<ServerMessage>>(
    type: K,
    listener: (event: RoomEventMap<ServerMessage>[K]) => void,
    options?: boolean | EventListenerOptions
  ): void;
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

### `join`

```ts
join(): void
```

Sends `"join"` (carrying the client's identity) to actually join the room on the server. `Client.room()` no longer joins implicitly — call this when you're ready. Repeated calls are a no-op once already joined.

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

## Events

`Room` supports any number of listeners per event (like `EventTarget`) — unrelated consumers can each `addEventListener` on the same room without clobbering one another, and `removeEventListener` only removes the listener passed in.

```ts
room.addEventListener("message", (event) => console.log(event.detail));
room.addEventListener("peer-joined", (event) => console.log(event.detail.clientId));
```

### `"message"`

```ts
CustomEvent<ServerMessage>
```

Dispatched for `"message"` envelopes from this room. Payload is `event.detail`.

### `"peer-joined"`

```ts
CustomEvent<{ clientId: string }>
```

Dispatched when a remote peer joins after you are already joined.

### `"peer-left"`

```ts
CustomEvent<{ clientId: string }>
```

Dispatched when a remote peer leaves or disconnects.

### `"peer-presence"`

```ts
CustomEvent<{ clientId: string; patch: PeerMetadata }>
```

Dispatched when a remote presence patch arrives. `peers` is already updated before the event fires.
