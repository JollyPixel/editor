# Server

Transport-agnostic router between raw client connections and registered `RoomAuthority` instances.

```ts
new Server(options?: ServerOptions)

interface ServerOptions {
  /**
   * @default a pino logger (`pino({ name: "network" })`)
   */
  logger?: Logger;
}

interface ClientHandle {
  readonly id: string;
  send(data: unknown): void;
}
```

## Properties

### `logger`

```ts
readonly logger: Logger
```

Logger used by the server lifecycle.

## Methods

### `register`

```ts
register(authority: RoomAuthority): void
```

Registers an authority by `authority.id`.

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
- Invalid or unroutable messages are ignored and logged.

## Behavior

- One `RoomAuthority` handles one room id.
- Rooms are activated by `register(authority)`.
- Message validation/parsing is centralized in `Envelope`.
- Logging goes through `ServerOptions.logger` (defaults to pino).

## See Also

- [`transport/websocket`](./transport/websocket.md)
- `packages/network/ARCHITECTURE.md`
