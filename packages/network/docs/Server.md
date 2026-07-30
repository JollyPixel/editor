# Server

Transport-agnostic router between raw client connections and registered `RoomAuthority` instances.

```ts
new Server(options?: ServerOptions)

interface ServerOptions {
  /**
   * @default a LogLayer instance backed by pino (`pino({ name: "network" })`)
   */
  logger?: Logger;
  /**
   * Per-role rights table, shared by every room this server registers.
   * Keys are glob patterns matched against `${authority.name}.${event}`.
   * Omitted (the default) means unrestricted access — every role can
   * write every event.
   */
  rights?: RightsMap;
}

interface ClientHandle {
  readonly id: string;
  send(data: unknown): void;
}
```

## ServerOptions

### `rights`

```ts
rights?: RightsMap
```

Single rights table for the whole server, matched against `${authority.name}.${event}` for every room `register()`ed on it — see [RightsTable](./RightsTable.md) and [RBAC](./RoomAuthority.md#rbac-minimal). There is no per-room override; a room registered with `name: "voxel.renderer"` is always subject to whatever `"voxel.renderer.*"`-style rules exist in this one table.

## Properties

### `logger`

```ts
readonly logger: Logger
```

`Logger` is `loglayer`'s `ILogLayer` type. Used by the server lifecycle, and passed down to every `ServerRoom` created via `register()`.

## Methods

### `register`

```ts
register(authority: RoomAuthority): void
```

Registers an authority by `authority.id`. Role/rights policy is *not* configured here — it's a single, server-wide table set once via `ServerOptions.rights` (see [RBAC](./RoomAuthority.md#rbac-minimal)), because `RoomAuthority` itself never knows about roles and because multiple instances of the same authority class (e.g. several `VoxelSyncServer` worlds) typically share the exact same constraints — one `ServerOptions.rights` entry, keyed by the authority's `name`, covers all of them regardless of how many distinct `id`s are registered.

### `broadcast`

```ts
broadcast(roomId: string, payload: unknown): void
```

Broadcasts a message to all members in `roomId`.

- Use this for server-originated pushes.
- No-op if room is unknown or empty.

### `handleConnect`

```ts
handleConnect(client: ClientHandle): void
```

Registers a connected client. Called by transport code.

### `handleDisconnect`

```ts
handleDisconnect(clientId: string): void
```

Disconnects a client from all joined rooms and clears server-side tracking.

### `handleMessage`

```ts
handleMessage(clientId: string, raw: unknown): void
```

Parses `raw` via `Envelope.parse` and routes room actions.

- Supports `"join"`, `"leave"`, `"message"`, and `"presence"` envelopes.
- A `"join"` is only recorded as membership when `ServerRoom.join()` returns `true` — a rights-denied join (see [`RoomAuthority`](./RoomAuthority.md#rbac-minimal)) leaves the client untracked, so later `"message"`/`"presence"` envelopes for that room keep being dropped as "client has not joined room".

## Behavior

- One `RoomAuthority` handles one room id.
- Rooms are activated by `register(authority)`.
- Message validation/parsing is centralized in `Envelope`.
- Logging goes through `ServerOptions.logger` (defaults to a pino-backed LogLayer).

## Logging

`handleMessage` emits exactly **one** structured ("wide") log event per call, at `debug` (handled) or `warn` (dropped), instead of one line per branch — so the full outcome of an envelope is always in a single record:

```json
{ "clientId": "...", "room": "...", "kind": "join", "outcome": "joined" }
{ "clientId": "...", "room": "...", "kind": "message", "outcome": "dropped", "reason": "client has not joined room" }
{ "clientId": "...", "outcome": "dropped", "reason": "malformed envelope", "error": "..." }
```

`outcome` is one of `"joined" | "left" | "handled" | "ignored" | "dropped"`, with `reason` set whenever it isn't self-explanatory. `register`/`handleConnect`/`handleDisconnect` each still emit their own single event (`info`/`debug`).

## See Also

- [`transport/websocket`](./transport/websocket.md)
- `packages/network/ARCHITECTURE.md`
