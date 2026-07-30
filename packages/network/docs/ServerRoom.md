# ServerRoom

Internal room runtime used by [`Server`](./Server.md). Implements `RoomHandle`.

```ts
new ServerRoom(
  authority: RoomAuthority,
  rights?: RightsTable, // @default new RightsTable() — unconfigured, fully open
  logger?: Logger       // @default a LogLayer instance backed by pino (`pino({ name: "network" })`)
)
```

Usually created by `Server.register()`, which passes in the single `RightsTable` the `Server` built once from `ServerOptions.rights` — every `ServerRoom` a given `Server` creates shares that same table (see [RBAC](./RoomAuthority.md#rbac-minimal)).

The constructor binds `{ room: authority.id }` onto `logger` via `withContext()`, so every event this room logs carries `room` automatically without repeating it at each call site.

All rights checks are looked up by `${authority.name}.${event}`, not by `authority.id` — so two `ServerRoom`s wrapping two different-`id` instances of the same authority class resolve rights identically.

## Methods

### `join`

```ts
join(clientId: string, client: ClientHandle, identity: PeerMetadata): boolean
```

Adds a client to the room and runs join flow. Returns whether the client was actually admitted.

- Resolves `role` from `identity.role` (`"default"` when absent/non-string) and checks it against `rights` for `${authority.name}.$join`.
- If the right isn't `"write"`, sends a `{ kind: "denied", event: "$join", reason }` envelope to the joining client only, never adds them as a member, and returns `false`. `Server` relies on this return value to avoid tracking the client as joined.
- Otherwise: notifies existing members, syncs existing members to the joining client, calls authority `onClientConnect`, and returns `true`.

### `leave`

```ts
leave(clientId: string): void
```

Removes a client from the room. Never rights-gated — a member can always leave.

- Notifies remaining members.
- Calls authority `onClientDisconnect`.

### `updatePresence`

```ts
updatePresence(clientId: string, patch: PeerMetadata): void
```

Checks the sender's role against `rights` for `${authority.name}.$presence`; if not `"write"`, sends a `"denied"` envelope back to the sender and drops the patch. Otherwise updates the member's presence and broadcasts `"peer-presence"` to other members, filtering out any recipient whose own role is `"void"` on that same key.

### `message`

```ts
message(clientId: string, payload: unknown): void
```

When `rights` is configured, resolves the sender's role and calls `authority.getEventName(payload)` to look up the write right for `${authority.name}.${event}`; a non-`"write"` result sends a `"denied"` envelope to the sender and the message never reaches the authority. Otherwise (or when `rights` isn't configured) forwards to authority `onMessage`.

### `broadcast`

```ts
broadcast(payload: unknown): void
```

Broadcasts a room message to all members — except, when `rights` is configured, members whose role has `"void"` on `${authority.name}.${authority.getEventName(payload)}`. `"read"` roles still receive the broadcast.

## Logging

Each method emits exactly **one** structured (`debug`) event per call — `room` (bound at construction), plus `clientId`/`role`/`outcome`/`reason` as applicable — instead of logging per branch:

- `join`: `outcome: "denied" | "admitted"`.
- `leave`: always `"leave"` (never rights-gated, so no `outcome` field).
- `updatePresence`: `outcome: "ignored" | "denied" | "applied"` (`"ignored"` = sender isn't a member; `"denied"` = rights check failed — both previously silent, now logged).
- `message`: logs only the `"denied"` case (rights check failed); the success path forwards straight to `authority.onMessage` unlogged, since it can be a hot path.

`broadcast`/`#send` are not logged — they can run per-frame in high-frequency sync scenarios (e.g. voxel/pixel sync servers), and adding per-broadcast logging would reintroduce the I/O overhead this design avoids.

## See Also

- [`RoomAuthority`](./RoomAuthority.md) — defines `name`/`events`/`getEventName()`, not the rights policy
- [`Server`](./Server.md#serveroptions) — where `rights` is actually configured
- [`RightsTable`](./RightsTable.md)
