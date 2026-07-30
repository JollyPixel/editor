# RoomAuthority

Abstract base class for a room's server-side logic. Extend it once per feature (pixel-art sync, voxel sync, ...) and register the instance with [`Server`](./Server.md).

```ts
abstract class RoomAuthority {
  abstract readonly id: string;
  abstract readonly name: string;
  readonly events: readonly string[];

  abstract onClientConnect(client: ClientHandle, identity: PeerMetadata, room: RoomHandle): void;
  abstract onClientDisconnect(clientId: string, room: RoomHandle): void;
  abstract onMessage(clientId: string, payload: unknown, room: RoomHandle): void;

  getEventName(payload: unknown): string;
}

interface RoomHandle {
  broadcast(payload: unknown): void;
}
```

`RoomAuthority` only ever declares *what* events exist for its room — it never decides *who* may use them. Role/rights policy is entirely a [`Server`](./Server.md#serveroptions) concern, configured once at `new Server({ rights })`, so a reusable authority (`VoxelSyncServer`, `PixelSyncServer`, ...) never needs to know about roles at all.

## Properties

### `id`

```ts
abstract readonly id: string
```

Room name this authority is registered under (`Server.register()` uses it as the routing key). Typically unique per instance — e.g. `"voxel-map:world-1"`, `"voxel-map:world-2"` for two worlds served by two `VoxelSyncServer` instances.

### `name`

```ts
abstract readonly name: string
```

Stable identifier for this authority's *type*, shared across every instance of the class — unlike `id`, which is per-room. Used to namespace rights-table lookups: `ServerRoom` checks `${name}.${event}` against the server's rights table, so one rule (e.g. `"voxel.renderer.*"`) covers every room backed by the same authority class, no matter how many distinct `id`s are registered under it (see [RBAC](#rbac-minimal)).

### `events`

```ts
readonly events: readonly string[]
```

Catalog of domain event names this authority accepts/emits (e.g. a voxel authority's action union). Defaults to `[]`. Purely declarative — read by whoever is writing the `ServerOptions.rights` table, to know what event names are valid to combine with `name`.

## Methods to implement

### `onClientConnect`

```ts
onClientConnect(client: ClientHandle, identity: PeerMetadata, room: RoomHandle): void
```

Called once a client has been admitted to the room (after any `$join` rights check has already passed — see [RBAC](#rbac-minimal)). `client.send()` is pre-scoped to this room — payloads are auto-wrapped in a `"message"` envelope.

### `onClientDisconnect`

```ts
onClientDisconnect(clientId: string, room: RoomHandle): void
```

Called on explicit `leave()` or socket disconnect. Never gated — a member can always leave.

### `onMessage`

```ts
onMessage(clientId: string, payload: unknown, room: RoomHandle): void
```

Called for a room-scoped `"message"` envelope, after the write-rights check has already passed (a rejected write never reaches this method). `room.broadcast(payload)` fans a reply out to the room, itself filtered by the server's rights table when one is configured.

### `getEventName`

```ts
getEventName(payload: unknown): string
```

Extracts the rights-table event name from a domain payload — e.g. `return (payload as MyCommand).action;`. Only called when the server was constructed with a rights table (`new Server({ rights })`); authorities running on a server without one don't need to override it. The base implementation throws, so a rights-configured server with an unimplemented `getEventName()` fails loudly on its first message rather than silently granting/denying the wrong thing.

## RBAC (minimal)

`RoomAuthority`, [`Server`](./Server.md), [`ServerRoom`](./ServerRoom.md), and the wire protocol together provide a small role-based access control layer, split by responsibility:

- **`RoomAuthority`** only exposes its type identity (`name`) and event vocabulary (`events`/`getEventName()`). It never sees roles or rights.
- **`Server`** owns the actual policy: `new Server({ rights })` builds one [`RightsTable`](./RightsTable.md) shared by every room the server registers. Only the application wiring up the server needs to know about roles.
- **Lookup keys are `${authority.name}.${event}`**, matched by glob pattern (only `*` is special) — e.g. `"voxel.renderer.voxel-set"` or `"voxel.renderer.*"` for every event of every `VoxelSyncServer`, regardless of `id`. This is why `name` (the authority's type) is what rights are keyed by, not `id` (a specific room instance).
- **Roles** are plain strings, read from `identity.role` at join time (`"default"` if absent or non-string). **Client-supplied and not independently verified** — this is not real authentication. If a caller needs the role to reflect a trusted identity (session, JWT, etc.), it must resolve that itself before constructing the `identity` object passed to `room.join()`.
- **Rights** are `"write"` / `"read"` / `"void"` per `(role, key)` pair. No table, an unknown role, or a key no pattern matches all fail open to `"write"` — a server constructed without a `rights` option keeps today's fully-open behavior.
- **Reserved events**: `"$join"` and `"$presence"` gate room admission and presence updates respectively (only `"write"` admits/allows; `"read"` collapses to denied for `$join` since joining is binary), namespaced by `name` the same as domain events — `"${name}.$join"`.
- **Enforcement** lives entirely in `ServerRoom`, not in `RoomAuthority` — a denied write or join never reaches `onMessage`/`onClientConnect`. Denials are sent back to the offending client only, as a `{ kind: "denied", event, reason }` envelope (see [`Room`](./Room.md#denied)).
- **Read gating is real fan-out filtering**: a `"void"` right excludes that client from the broadcast of that event entirely (they never receive the payload); `"read"` still receives broadcasts but can't send.

See [`RightsTable`](./RightsTable.md) for the glob-matching lookup class, [`Server`](./Server.md#serveroptions) for where the policy is configured, and [`ServerRoom`](./ServerRoom.md) for where each check happens.

## See Also

- [`ServerRoom`](./ServerRoom.md)
- [`Server`](./Server.md)
- [`RightsTable`](./RightsTable.md)
