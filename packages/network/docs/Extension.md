# Extension

Abstract base for a room's server-side logic. Extend it once per feature (pixel-art sync, voxel sync, ...) and register the instance on a [Server](./Server.md).

```ts
abstract class Extension {
  abstract readonly id: string;
  abstract readonly name: string;
  readonly events: readonly string[];

  abstract onClientConnect(
    client: ClientHandle,
    identity: PeerMetadata,
    context: RoomContext
  ): void | Promise<void>;
  abstract onClientDisconnect(clientId: string, context: RoomContext): void | Promise<void>;
  abstract onMessage(clientId: string, payload: unknown, context: RoomContext): void | Promise<void>;

  getEventName(payload: unknown): string;
}

interface RoomContext {
  readonly room: RoomBroadcast;
  readonly eventStore: RoomEventStoreHandle;
}

interface RoomBroadcast {
  broadcast(payload: unknown): void;
  sendTo(clientId: string, payload: unknown): void;
}
```

`RoomEventStoreHandle.append()` and `.list()` return Promises. Return a Promise from a lifecycle method when its work is asynchronous.

`RoomBroadcast` is stable for the room's lifetime, so an extension can keep it for later use. `sendTo` addresses one member by `clientId`.

- `id` — the room name this instance is registered under, typically unique per instance (`"voxel-map:world-1"`).
- `name` — the extension *type*, shared by every instance of the class. Rights keys are built from it, so one rule covers every room the class backs.
- `events` — domain event names accepted by this extension. Defaults to `[]`; use these names when defining rights.

## Callbacks

- `onClientConnect` — the client is already admitted. Its `client.send()` is pre-scoped to this room.
- `onClientDisconnect` — explicit `leave()` or socket drop. Never gated; a member can always leave.
- `onMessage` — a room-scoped message that already passed its write check. A rejected write never reaches here.
- `getEventName(payload)` — returns the event name used for rights lookups (e.g. `return payload.action`). It is called only when the server has a rights table. The base implementation throws.

`context` is built for the triggering client. The rights table filters recipients of `context.room.broadcast()` when rights are configured.

## Worker extensions

Register a `WorkerExtensionDescriptor` to run CPU-bound handlers in a dedicated `worker_threads.Worker`. Write the extension itself the same way as an in-process extension.

```ts
interface WorkerExtensionDescriptor {
  id: string;
  name: string;
  getEventName?: (payload: unknown) => string;
  modulePath: string | URL;
  exportName?: string;
  workerData?: unknown;
  rpcTimeoutMs?: number;
  maxRestarts?: number;
  restartWindowMs?: number;
}

server.register({
  id: "voxel-map:world-1",
  name: "voxel.renderer",
  modulePath: new URL("./extensions/VoxelMeshExtension.ts", import.meta.url),
  workerData: { chunkSize: 32 }
});
```

- `id` / `name` / `getEventName` — same meaning as the matching `Extension` members. Provide `getEventName` when the server has a rights table.
- `modulePath` / `exportName` — dynamically `import()`ed, then constructed as `module[exportName ?? "default"](workerData)`.
- `workerData` — the constructor's argument; must be structured-cloneable (no functions or live objects).
- `rpcTimeoutMs` (default `10_000`) — timeout for calls to the worker and calls from the worker into `RoomContext`.
- `maxRestarts` / `restartWindowMs` (default `5` / `60_000`) — restart limit after crashes or RPC timeouts. Once reached, further messages are logged and dropped.

Each registration owns one worker and processes its calls sequentially. A slow handler delays later calls to that extension, but does not block the main thread or other rooms. Per-client ordering still applies; see [Server](./Server.md).

Call `server.close()` before the process exits if any worker-mode extension was registered.

## Presence-only rooms

Use `PresenceOnlyExtension` when a room needs only join and presence events:

```ts
server.register(new PresenceOnlyExtension("voxel-map:world-1"));
```

Its `name` defaults to the shared constant `"presence-only"`, so one rights rule (e.g. `"presence-only.$join"`) covers every presence-only room. Pass a second argument to give the room its own rights namespace:

```ts
new PresenceOnlyExtension("voxel-map:world-1", "voxel-map:world-1");
```

## Disposal

```ts
dispose?(): void | Promise<void>;
```

Optional. Called when the room is disposed — on `Server.close()`, or when a
dynamically resolved room's grace period expires (see
[Dynamic rooms](./Server.md#dynamic-rooms)). Release timers, subscriptions
and cached handles here.

## Actors

`RoomEventStoreHandle.append` takes an `AppendInput` **without** `actor`:

```ts
type RoomAppendInput = Omit<EventStore.AppendInput, "actor">;
```

The server fills in `actor` from the member's identity. It uses `userId` when
present and otherwise falls back to the transport client ID. Extensions cannot
set or omit the actor.
