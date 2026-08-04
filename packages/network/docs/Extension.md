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

`RoomEventStoreHandle.append`/`.list` return Promises. For an in-process extension this resolves on the same tick in practice (no real thread crossing); a worker-mode extension's calls genuinely round-trip to the main thread. The three lifecycle methods may return `void` or `Promise<void>` — return a Promise if the handler does anything async (including a worker-mode extension, where it always does).

`RoomBroadcast` is stable for the room's whole lifetime — safe to stash and call later, e.g. from a timer, not just from inside a dispatch. `sendTo` addresses one member by clientId; it's how a worker-hosted extension reaches a client it cached from an earlier `onClientConnect`, since it can't hold onto the literal `ClientHandle` across the thread boundary.

- `id` — the room name this instance is registered under, typically unique per instance (`"voxel-map:world-1"`).
- `name` — the extension *type*, shared by every instance of the class. Rights keys are built from it, so one rule covers every room the class backs.
- `events` — declarative catalog of the domain event names this extension accepts. Defaults to `[]`, and is read by whoever writes the rights table.

An extension declares *what* events exist for its room, never *who* may use them.

## Callbacks

- `onClientConnect` — the client is already admitted. Its `client.send()` is pre-scoped to this room.
- `onClientDisconnect` — explicit `leave()` or socket drop. Never gated; a member can always leave.
- `onMessage` — a room-scoped message that already passed its write check. A rejected write never reaches here.
- `getEventName(payload)` — extracts the event name used for rights lookups (e.g. `return payload.action`). Only called when the server was built with a rights table; the base implementation throws, so a misconfiguration fails loudly instead of granting the wrong thing. Always runs on the main thread, even for a worker-mode extension (see below) — rights-gating has to reject a message before paying a worker round-trip, not after.

`context` is built per triggering client, but `context.room` is a stable shared broadcaster — safe to stash and call later. Its `broadcast()` fan-out is itself filtered by the rights table when one is configured.

## Worker Extensions

Register a `WorkerExtensionDescriptor` instead of an `Extension` instance to move CPU-bound handlers off the main event loop, into a dedicated `worker_threads.Worker`. `Server`/`ServerRoom` only ever see an `Extension` — worker-ness is a registration-time decision, not something the class itself needs to know about, so write it exactly like an in-process extension.

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

- `id` / `name` / `getEventName` — same meaning as the matching `Extension` member. Supplied directly because `Server` needs them synchronously, before the worker has even loaded — `getEventName` in particular must run on the main thread for rights-gating. Omit it if the server has no rights table.
- `modulePath` / `exportName` — dynamically `import()`ed, then constructed as `module[exportName ?? "default"](workerData)`.
- `workerData` — the constructor's argument; must be structured-cloneable (no functions, no live objects), since it crosses `postMessage`.
- `rpcTimeoutMs` (default `10_000`) — bounds every cross-thread call: a dispatch into the worker, and the worker's own calls back into `RoomContext`.
- `maxRestarts` / `restartWindowMs` (default `5` / `60_000`) — a crash or RPC timeout logs the failure and respawns the worker. Past this many restarts inside the window, the extension is marked dead: further messages are logged and dropped rather than retried indefinitely.

One persistent worker per registration, not a pool: calls to it are effectively serialized, so a slow handler delays only the *next* call to that same extension, never the main thread or any other room. Per-client ordering (see [Server](./Server.md)) still applies on top of that.

Call `server.close()` before the process exits if any worker-mode extension was registered.
