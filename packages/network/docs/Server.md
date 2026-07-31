# Server

Transport-agnostic router between raw connections and registered `Extension` instances. One extension serves one room id, so unrelated features share a single socket without knowing about each other.

```ts
new Server(options?: ServerOptions)

interface ServerOptions {
  logger?: Logger;
  /**
   * Per-role rights table, shared by every room this server registers.
   * Omitted means unrestricted access.
   */
  rights?: RightsMap;
  eventStore?: EventStore.EventStore;
}
```

- `register(extension)` — activates a room, keyed by `extension.id`.
- `logger` — a `loglayer` `ILogLayer`, defaulting to a pino-backed instance, passed down to every room.
- `rights` — see [Rights](./Rights.md). One table for the whole server; there is no per-room override.

`handleConnect` / `handleDisconnect` / `handleMessage` are called by transport code, not by application code.

## Extension

Abstract base for a room's server-side logic. Extend it once per feature (pixel-art sync, voxel sync, ...) and register the instance.

```ts
abstract class Extension {
  abstract readonly id: string;
  abstract readonly name: string;
  readonly events: readonly string[];

  abstract onClientConnect(
    client: ClientHandle,
    identity: PeerMetadata,
    context: RoomContext
  ): void;
  abstract onClientDisconnect(clientId: string, context: RoomContext): void;
  abstract onMessage(clientId: string, payload: unknown, context: RoomContext): void;

  getEventName(payload: unknown): string;
}

interface RoomContext {
  readonly room: RoomBroadcast;
  readonly eventStore: RoomEventStoreHandle;
}
```

- `id` — the room name this instance is registered under, typically unique per instance (`"voxel-map:world-1"`).
- `name` — the extension *type*, shared by every instance of the class. Rights keys are built from it, so one rule covers every room the class backs.
- `events` — declarative catalog of the domain event names this extension accepts. Defaults to `[]`, and is read by whoever writes the rights table.

An extension declares *what* events exist for its room, never *who* may use them.

## Callbacks

- `onClientConnect` — the client is already admitted. Its `client.send()` is pre-scoped to this room.
- `onClientDisconnect` — explicit `leave()` or socket drop. Never gated; a member can always leave.
- `onMessage` — a room-scoped message that already passed its write check. A rejected write never reaches here.
- `getEventName(payload)` — extracts the event name used for rights lookups (e.g. `return payload.action`). Only called when the server was built with a rights table; the base implementation throws, so a misconfiguration fails loudly instead of granting the wrong thing.

`context` is built per triggering client, but `context.room` is a stable shared broadcaster — safe to stash and call later. Its `broadcast()` fan-out is itself filtered by the rights table when one is configured.
