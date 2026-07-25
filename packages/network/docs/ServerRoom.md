# ServerRoom

Internal room runtime used by [`Server`](./Server.md). Implements `RoomHandle`.

```ts
new ServerRoom(
  authority: RoomAuthority,
  logger?: Logger // @default a pino logger (`pino({ name: "network" })`)
)
```

Usually created by `Server.register()`.

## Methods

### `join`

```ts
join(clientId: string, client: ClientHandle, identity: PeerMetadata): void
```

Adds a client to the room and runs join flow.

- Notifies existing members.
- Syncs existing members to the joining client.
- Calls authority `onClientConnect`.

### `leave`

```ts
leave(clientId: string): void
```

Removes a client from the room.

- Notifies remaining members.
- Calls authority `onClientDisconnect`.

### `updatePresence`

```ts
updatePresence(clientId: string, patch: PeerMetadata): void
```

Updates a member's presence and notifies other members.

### `message`

```ts
message(clientId: string, payload: unknown): void
```

Forwards a room message to authority `onMessage`.

### `broadcast`

```ts
broadcast(payload: unknown): void
```

Broadcasts a room message to all members.
