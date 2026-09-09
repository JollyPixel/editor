# Extension

Abstract base for a room's server-side logic. Extend it once per feature (pixel-art sync, voxel sync, ...) and register the instance on a [Server](./Server.md).

```ts
abstract class Extension<TMessage = unknown> {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly protocols: MessageProtocols;

  abstract onClientConnect(
    client: ClientHandle,
    identity: PeerMetadata,
    context: RoomContext
  ): void | Promise<void>;
  abstract onClientDisconnect(clientId: string, context: RoomContext): void | Promise<void>;
  abstract onMessage(clientId: string, message: TMessage, context: RoomContext): void | Promise<void>;
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
- `protocols` — the JSON Schemas describing what the room accepts and what it emits. See below.

Use `AnyExtension` (`Extension<unknown>`) wherever you need to hold an extension whose message type you don't care about.

## Message protocols

```ts
interface MessageProtocol {
  readonly schema: JSONSchema;
  /**
   * @default "action"
   */
  readonly discriminator?: string;
}

interface MessageProtocols {
  readonly inbound: MessageProtocol | null;
  readonly outbound: MessageProtocol | null;
}
```

A protocol's schema is a union (`oneOf` or `anyOf`) whose variants each name one event. A variant names its event with a `const` on the discriminator property, or with an explicit `title` when the name can't be read off a single property:

```ts
const voxelCommands = defineMessageProtocol({
  schema: defineSchema({
    oneOf: [
      {
        type: "object",
        properties: {
          action: { const: "voxel-set" },
          layerName: { type: "string" }
        },
        required: ["action", "layerName"]
      },
      {
        type: "object",
        properties: { action: { const: "voxel-removed" } },
        required: ["action"]
      }
    ]
  })
});

type VoxelCommand = InferMessage<typeof voxelCommands>;
```

`InferMessage` derives the TypeScript union from the schema, so `Extension<VoxelCommand>` receives a message that is already narrowed by the time `onMessage` runs. `protocolEvents(protocol)` returns the event names a protocol declares, which is what [rights](./Rights.md) rules match against. A variant that names no event throws `InvalidMessageProtocolError` when the room is built, not on the first message.

Two protocols are shipped for the cases that have no domain schema of their own:

- `OPAQUE_PROTOCOLS` — `{ inbound: null, outbound: null }`. Payloads pass through unparsed, exactly as before this API existed. A server with a rights table refuses to register an extension whose `inbound` is `null`, because a payload it never parses is a payload it cannot gate; the error is `UngatedExtensionError`, raised at registration.
- `NO_MESSAGE_PROTOCOLS` — built on `NO_MESSAGES`, a schema nothing matches. Use it for a room that carries no domain messages at all.

### Inbound

The room parses a client payload against `inbound.schema` before anything else runs. On a match, the variant's event name goes to the rights check and `onMessage` gets the parsed message. On a miss, the author gets an `"error"` envelope naming `$message`, and the extension is never called.

### Outbound

`context.room.broadcast()` and `sendTo()` parse against `outbound.schema` and use the matched event to filter recipients by their read rights. A payload that doesn't match is a server-side bug: it is logged at `error` level and not sent.

Most extensions emit the `NetworkServerMessage` shape (`{ type: "snapshot" | "command", data }`). `serverMessageProtocol()` builds the matching outbound protocol from the inbound one, mapping a snapshot to the reserved `$snapshot` event and each command to its own inner event name:

```ts
const protocols: MessageProtocols = {
  inbound: voxelCommands,
  outbound: serverMessageProtocol({
    command: voxelCommands,
    snapshot: voxelWorldSchema
  })
};
```

A rule on `voxel.renderer.voxel-set` then covers both directions of that command.

### Command headers

Commands stamped by [SyncAdapter](./sync/SyncAdapter.md) carry `clientId`, `seq` and `timestamp`. Spread the shipped fragments into a variant rather than restating them:

```ts
const variant = defineSchema({
  type: "object",
  properties: {
    ...commandHeaderProperties,
    action: { const: "voxel-set" }
  },
  required: [...COMMAND_HEADER_REQUIRED, "action"]
});
```

## Callbacks

- `onClientConnect` — the client is already admitted. Its `client.send()` is pre-scoped to this room and filtered by the outbound protocol.
- `onClientDisconnect` — explicit `leave()` or socket drop. Never gated; a member can always leave.
- `onMessage` — a message that parsed against the inbound protocol and passed its write check. A rejected or denied payload never reaches here.

`context` is built for the triggering client.

## Worker extensions

Register a `WorkerExtensionDescriptor` to run CPU-bound handlers in a dedicated `worker_threads.Worker`. Write the extension itself the same way as an in-process extension.

```ts
interface WorkerExtensionDescriptor {
  id: string;
  name: string;
  protocols: MessageProtocols;
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
  protocols,
  modulePath: new URL("./extensions/VoxelMeshExtension.ts", import.meta.url),
  workerData: { chunkSize: 32 }
});
```

- `id` / `name` / `protocols` — same meaning as the matching `Extension` members. Parsing happens on the main thread, so the worker receives an already-parsed message.
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

Its protocols default to `NO_MESSAGE_PROTOCOLS`, or to `OPAQUE_PROTOCOLS` when constructed with `{ broadcast: true }`. Pass `protocols` explicitly to relay messages on a rights-configured server.

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
