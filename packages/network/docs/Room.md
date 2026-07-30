# Room

Client-side handle to one room, obtained via [`Client.room()`](./Client.md#room). Do not construct directly.

```ts
interface RoomPeerEvent {
  clientId: string;
}

interface RoomPeerPresenceEvent extends RoomPeerEvent {
  patch: PeerMetadata;
}

interface RoomDeniedEvent {
  event: string;
  reason: string;
}

interface RoomEventMap<ServerMessage = unknown> {
  message: (payload: ServerMessage) => void;
  "peer-joined": (event: RoomPeerEvent) => void;
  "peer-left": (event: RoomPeerEvent) => void;
  "peer-presence": (event: RoomPeerPresenceEvent) => void;
  denied: (event: RoomDeniedEvent) => void;
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

  on<K extends keyof RoomEventMap<ServerMessage>>(
    type: K,
    listener: RoomEventMap<ServerMessage>[K]
  ): void;
  off<K extends keyof RoomEventMap<ServerMessage>>(
    type: K,
    listener: RoomEventMap<ServerMessage>[K]
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

`Room` supports any number of listeners per event — unrelated consumers can each `on` the same room without clobbering one another, and `off` only removes the listener passed in. Listeners receive the payload directly (no `CustomEvent`/`.detail` wrapping).

```ts
room.on("message", (payload) => console.log(payload));
room.on("peer-joined", (event) => console.log(event.clientId));
```

### `"message"`

```ts
ServerMessage
```

Fired for `"message"` envelopes from this room. Payload is passed through as-is.

### `"peer-joined"`

```ts
{ clientId: string }
```

Fired when a remote peer joins after you are already joined.

### `"peer-left"`

```ts
{ clientId: string }
```

Fired when a remote peer leaves or disconnects.

### `"peer-presence"`

```ts
{ clientId: string; patch: PeerMetadata }
```

Fired when a remote presence patch arrives. `peers` is already updated before the event fires.

### `"denied"`

```ts
{ event: string; reason: string }
```

Fired when the server rejects an action of this client's own — a join, a presence update, or a `send()` — because its role's [`RightsTable`](./RightsTable.md) right for `event` wasn't `"write"`. `event` is `"$join"`, `"$presence"`, or the domain event name the authority's `getEventName()` returned; `reason` is a human-readable message. See [`RoomAuthority`](./RoomAuthority.md#rbac-minimal) for the underlying RBAC model.
